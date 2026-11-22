# mood transfer core
# idea: VGG-19 sirf judge hai, painter nahi. hum ek chota sa colour grade seekhte hain
# (3D LUT + smooth light grid) taake output photo hi rahe, painting na ban jaye

import os
import threading
import time

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, ImageOps
from torchvision.models import vgg19, VGG19_Weights

torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))

vggMean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
vggStd = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)

# vgg19.features ke andar layer index -> naam
styleLayers = {1: "relu1_1", 6: "relu2_1", 11: "relu3_1", 20: "relu4_1"}
styleWeights = {"relu1_1": 1.0, "relu2_1": 1.0, "relu3_1": 0.6, "relu4_1": 0.4}
contentLayer = 22  # relu4_2

defaultSettings = {
    "iterations": 120,
    "workSize": 256,      # optimise isi size pe, phir full photo pe lagao
    "lutSize": 17,
    "lightGrid": 8,       # 0 means light grid off
    "styleWeight": 1.0,
    "colorWeight": 1.0,
    "contentWeight": 1.0,
    "learningRate": 0.02,
    "maxSide": 4000,
}

vggModel = None
vggLock = threading.Lock()


def getVgg():
    global vggModel
    with vggLock:
        if vggModel is None:
            net = vgg19(weights=VGG19_Weights.IMAGENET1K_V1).features[:contentLayer + 1].eval()
            for p in net.parameters():
                p.requires_grad_(False)
            vggModel = net
    return vggModel


# ---------- image helpers ----------

def loadImage(fileOrPath, maxSide):
    img = Image.open(fileOrPath)
    img = ImageOps.exif_transpose(img).convert("RGB")  # phone photos ulti na aayein
    if max(img.size) > maxSide:
        img.thumbnail((maxSide, maxSide), Image.LANCZOS)
    return img


def toTensor(img):
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0)


def toImage(t):
    arr = t.squeeze(0).permute(1, 2, 0).clamp(0, 1).numpy()
    return Image.fromarray((arr * 255 + 0.5).astype(np.uint8))


def shrink(img, side):
    small = img.copy()
    small.thumbnail((side, side), Image.LANCZOS)
    return small


# ---------- the grade itself ----------

def identityLut(size):
    # lut[c, b, g, r], yani depth = blue, height = green, width = red
    steps = torch.linspace(0, 1, size)
    b, g, r = torch.meshgrid(steps, steps, steps, indexing="ij")
    return torch.stack([r, g, b]).unsqueeze(0)  # (1, 3, S, S, S)


def applyLut(img, lut):
    # trilinear lookup, grid_sample 3D wala kaam kar deta hai
    grid = img.permute(0, 2, 3, 1).unsqueeze(1) * 2 - 1  # (1, 1, H, W, 3) as x=r y=g z=b
    out = F.grid_sample(lut, grid, mode="bilinear", padding_mode="border", align_corners=True)
    return out.squeeze(2)


def applyLight(img, gainGrid):
    if gainGrid is None:
        return img
    h, w = img.shape[2], img.shape[3]
    gain = F.interpolate(gainGrid, size=(h, w), mode="bicubic", align_corners=False)
    return (img * torch.exp(gain)).clamp(0, 1)


def gradeImage(img, lut, gainGrid):
    return applyLight(applyLut(img, lut), gainGrid)


# ---------- classical baseline: Reinhard et al. 2001 (l-alpha-beta space) ----------

rgbToLms = np.array([[0.3811, 0.5783, 0.0402],
                     [0.1967, 0.7244, 0.0782],
                     [0.0241, 0.1288, 0.8444]])
lmsToRgb = np.linalg.inv(rgbToLms)
logLmsToLab = np.diag([1 / np.sqrt(3), 1 / np.sqrt(6), 1 / np.sqrt(2)]) @ np.array([[1, 1, 1], [1, 1, -2], [1, -1, 0]])
labToLogLms = np.linalg.inv(logLmsToLab)


def rgbToLab(pixels):
    lms = np.clip(pixels @ rgbToLms.T, 1e-4, None)
    return np.log10(lms) @ logLmsToLab.T


def labToRgb(lab):
    lms = 10 ** (lab @ labToLogLms.T)
    return np.clip(lms @ lmsToRgb.T, 0, 1)


def labStats(img):
    pixels = np.asarray(shrink(img, 512), dtype=np.float64).reshape(-1, 3) / 255.0
    lab = rgbToLab(pixels)
    return lab.mean(0), lab.std(0) + 1e-6


def reinhard(pixels, srcStats, dstStats):
    # mean aur std match karo har channel mein, bas itna hi hai Reinhard
    lab = rgbToLab(pixels)
    lab = (lab - srcStats[0]) / srcStats[1] * dstStats[1] + dstStats[0]
    return labToRgb(lab)


def reinhardImage(img, srcStats, dstStats):
    arr = np.asarray(img, dtype=np.float64) / 255.0
    out = reinhard(arr.reshape(-1, 3), srcStats, dstStats).reshape(arr.shape)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8))


# ---------- losses ----------

def vggFeatures(net, x):
    x = (x - vggMean) / vggStd
    feats = {}
    for i, layer in enumerate(net):
        x = layer(x)
        if i in styleLayers:
            feats[styleLayers[i]] = x
        if i == contentLayer:
            feats["content"] = x
    return feats


def gram(f):
    _, c, h, w = f.shape
    flat = f.view(c, h * w)
    return flat @ flat.t() / (c * h * w)


def slicedColourLoss(outPixels, moodPixels, projections=24):
    # sliced Wasserstein: random directions pe project karo, sort karo, compare karo
    # poora colour distribution match hota hai, sirf mean/std nahi
    dirs = F.normalize(torch.randn(3, projections), dim=0)
    a = torch.sort(outPixels @ dirs, dim=0)[0]
    b = torch.sort(moodPixels @ dirs, dim=0)[0]
    return ((a - b) ** 2).mean()


def samplePixels(img, count):
    flat = img.squeeze(0).reshape(3, -1).t()
    idx = torch.randint(0, flat.shape[0], (count,))
    return flat[idx]


def lutSmoothness(lut):
    dr = lut[..., 1:] - lut[..., :-1]
    dg = lut[..., 1:, :] - lut[..., :-1, :]
    db = lut[:, :, 1:] - lut[:, :, :-1]
    return (dr ** 2).mean() + (dg ** 2).mean() + (db ** 2).mean()


def lutMonotonic(lut):
    # red output red input ke saath barhna chahiye, warna colours ulte ho jate hain
    dr = lut[:, 0, :, :, 1:] - lut[:, 0, :, :, :-1]
    dg = lut[:, 1, :, 1:, :] - lut[:, 1, :, :-1, :]
    db = lut[:, 2, 1:, :, :] - lut[:, 2, :-1, :, :]
    return F.relu(-dr).mean() + F.relu(-dg).mean() + F.relu(-db).mean()


def lightSmoothness(gainGrid):
    dx = gainGrid[..., 1:] - gainGrid[..., :-1]
    dy = gainGrid[..., 1:, :] - gainGrid[..., :-1, :]
    return (dx ** 2).mean() + (dy ** 2).mean() + 0.1 * (gainGrid ** 2).mean()


# ---------- main loop ----------

class Cancelled(Exception):
    pass


def transferMood(contentImg, moodImg, settings=None, onProgress=None, shouldStop=None):
    s = dict(defaultSettings)
    s.update(settings or {})
    net = getVgg()
    started = time.time()

    contentSmall = toTensor(shrink(contentImg, s["workSize"]))
    moodSmall = toTensor(shrink(moodImg, s["workSize"]))

    # warm start: LUT ko Reinhard se shuru karo, is se jaldi converge hota hai
    srcStats, dstStats = labStats(contentImg), labStats(moodImg)
    baseLut = identityLut(s["lutSize"])
    nodes = baseLut.squeeze(0).permute(1, 2, 3, 0).reshape(-1, 3).numpy().astype(np.float64)
    warm = reinhard(nodes, srcStats, dstStats).astype(np.float32)
    warmLut = torch.from_numpy(warm).view(s["lutSize"], s["lutSize"], s["lutSize"], 3).permute(3, 0, 1, 2).unsqueeze(0)
    lut = (0.5 * warmLut + 0.5 * baseLut).clone().requires_grad_(True)

    params = [lut]
    gainGrid = None
    if s["lightGrid"]:
        gainGrid = torch.zeros(1, 1, s["lightGrid"], s["lightGrid"], requires_grad=True)
        params.append(gainGrid)

    with torch.no_grad():
        moodFeats = vggFeatures(net, moodSmall)
        moodGrams = {k: gram(moodFeats[k]) for k in styleWeights}
        contentFeats = vggFeatures(net, contentSmall)["content"]
        moodPixels = moodSmall.squeeze(0).reshape(3, -1).t()

    opt = torch.optim.Adam(params, lr=s["learningRate"])
    history = []
    total = s["iterations"]
    for step in range(1, total + 1):
        if shouldStop and shouldStop():
            raise Cancelled()
        opt.zero_grad()
        out = gradeImage(contentSmall, lut, gainGrid)
        feats = vggFeatures(net, out)

        styleLoss = sum(styleWeights[k] * F.mse_loss(gram(feats[k]), moodGrams[k]) for k in styleWeights) * 1e3
        contentLoss = F.mse_loss(feats["content"], contentFeats) * 1e-1
        n = min(4096, moodPixels.shape[0])
        colourLoss = slicedColourLoss(samplePixels(out, n), moodPixels[torch.randint(0, moodPixels.shape[0], (n,))]) * 1e2
        regLoss = lutSmoothness(lut) * 10 + lutMonotonic(lut) * 100
        if gainGrid is not None:
            regLoss = regLoss + lightSmoothness(gainGrid) * 5

        loss = s["styleWeight"] * styleLoss + s["contentWeight"] * contentLoss + s["colorWeight"] * colourLoss + regLoss
        loss.backward()
        opt.step()
        with torch.no_grad():
            lut.clamp_(0, 1)
            if gainGrid is not None:
                gainGrid.clamp_(-1.0, 1.0)

        row = {"step": step, "style": round(styleLoss.item(), 4), "content": round(contentLoss.item(), 4),
               "colour": round(colourLoss.item(), 4), "total": round(loss.item(), 4)}
        history.append(row)
        if onProgress:
            preview = None
            if step % 10 == 0 or step == total:
                with torch.no_grad():
                    preview = toImage(gradeImage(contentSmall, lut, gainGrid))
            onProgress(step, total, row, preview, time.time() - started)

    lutFinal = lut.detach()
    gainFinal = gainGrid.detach() if gainGrid is not None else None
    return {
        "lut": lutFinal,
        "gain": gainFinal,
        "history": history,
        "baseline": reinhardImage(contentImg, srcStats, dstStats),
        "seconds": time.time() - started,
        "settings": s,
    }


def gradeFull(img, lut, gainGrid, stripRows=512):
    # full size pe strips mein lagao taake RAM na phatay
    src = toTensor(img)
    h, w = src.shape[2], src.shape[3]
    out = torch.empty_like(src)
    gain = None
    if gainGrid is not None:
        gain = torch.exp(F.interpolate(gainGrid, size=(h, w), mode="bicubic", align_corners=False))
    with torch.no_grad():
        for y in range(0, h, stripRows):
            part = applyLut(src[:, :, y:y + stripRows], lut)
            if gain is not None:
                part = (part * gain[:, :, y:y + stripRows]).clamp(0, 1)
            out[:, :, y:y + stripRows] = part
    return toImage(out)


def lutToCube(lut, title):
    size = lut.shape[-1]
    lines = [f'TITLE "{title}"', f"LUT_3D_SIZE {size}", "DOMAIN_MIN 0.0 0.0 0.0", "DOMAIN_MAX 1.0 1.0 1.0"]
    data = lut.squeeze(0)
    # .cube mein red sab se tez badalta hai, phir green, phir blue
    for b in range(size):
        for g in range(size):
            for r in range(size):
                lines.append("%.6f %.6f %.6f" % (data[0, b, g, r], data[1, b, g, r], data[2, b, g, r]))
    return "\n".join(lines) + "\n"


def lutToList(lut):
    return [round(v, 4) for v in lut.squeeze(0).permute(1, 2, 3, 0).reshape(-1).tolist()]
