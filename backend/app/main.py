# FastAPI server: jobs queue, mood library, files
import io
import math
import json
import shutil
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image

from . import mood

rootDir = Path(__file__).resolve().parents[1]
dataDir = rootDir / "data"
jobsDir = dataDir / "jobs"
moodsDir = dataDir / "moods"
for d in (jobsDir, moodsDir):
    d.mkdir(parents=True, exist_ok=True)

viewSide = 1600   # UI ke liye chhoti copies, download full size hota hai
allowedFiles = {"result.png", "result.jpg", "baseline.png", "baseline.jpg", "content.jpg", "mood.jpg", "lut.cube"}

app = FastAPI(title="Mood Transfer")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

worker = ThreadPoolExecutor(max_workers=1)  # CPU pe ek waqt mein ek hi job, warna sab slow
jobs = {}
jobsLock = threading.Lock()


def clean(value):
    # NaN/inf JSON mein nahi ja sakte, warna poora response 500 ho jata hai
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value


def publicJob(job):
    keys = ("id", "status", "step", "total", "losses", "history", "elapsed", "eta", "error", "moodId",
            "contentName", "moodName", "previewVersion", "queuedAt", "settings", "size")
    return clean({k: job.get(k) for k in keys})


def saveView(img, path):
    view = mood.shrink(img, viewSide)
    view.save(path, quality=90)


def nextMoodCode():
    count = len([p for p in moodsDir.iterdir() if p.is_dir()])
    return "M-%03d" % (count + 1)


def swatchOf(img, count=5):
    # mood ke 5 main colours, library card ke liye
    small = mood.shrink(img, 64).quantize(colors=count, method=Image.Quantize.MEDIANCUT)
    pal = small.getpalette()[:count * 3]
    return ["#%02x%02x%02x" % tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]



def runJob(jobId, contentPath, moodPath):
    job = jobs[jobId]
    folder = jobsDir / jobId
    try:
        job["status"] = "running"
        settings = job["settings"]
        contentImg = mood.loadImage(contentPath, settings.get("maxSide", 4000))
        moodImg = mood.loadImage(moodPath, settings.get("maxSide", 4000))
        job["size"] = list(contentImg.size)
        saveView(contentImg, folder / "content.jpg")
        saveView(moodImg, folder / "mood.jpg")

        def onProgress(step, total, row, preview, elapsed):
            job["step"], job["total"], job["losses"] = step, total, row
            job["history"].append(row)
            job["elapsed"] = round(elapsed, 1)
            job["eta"] = round(elapsed / step * (total - step), 1)
            if preview is not None:
                buf = io.BytesIO()
                preview.save(buf, "JPEG", quality=85)
                job["preview"] = buf.getvalue()
                job["previewVersion"] += 1

        out = mood.transferMood(contentImg, moodImg, settings, onProgress, lambda: job["cancel"])
        job["status"] = "grading"
        result = mood.gradeFull(contentImg, out["lut"], out["gain"])
        result.save(folder / "result.png")
        saveView(result, folder / "result.jpg")
        out["baseline"].save(folder / "baseline.png")
        saveView(out["baseline"], folder / "baseline.jpg")
        title = Path(job["moodName"]).stem
        (folder / "lut.cube").write_text(mood.lutToCube(out["lut"], title))

        # library mein save karo taake kisi aur photo pe bhi laga sakein
        moodId = uuid.uuid4().hex[:10]
        code = nextMoodCode()
        mdir = moodsDir / moodId
        mdir.mkdir()
        torch.save({"lut": out["lut"], "gain": out["gain"]}, mdir / "grade.pt")
        shutil.copy(folder / "mood.jpg", mdir / "mood.jpg")
        shutil.copy(folder / "lut.cube", mdir / "lut.cube")
        meta = {"id": moodId, "code": code, "name": title, "createdAt": time.time(),
                "swatch": swatchOf(moodImg), "lutSize": out["lut"].shape[-1], "fromJob": jobId,
                "lut": mood.lutToList(out["lut"])}
        (mdir / "meta.json").write_text(json.dumps(meta))
        job["moodId"] = moodId
        job["elapsed"] = round(out["seconds"], 1)
        job["eta"] = 0
        job["status"] = "done"
    except mood.Cancelled:
        job["status"] = "cancelled"
    except Exception as error:
        job["status"] = "failed"
        job["error"] = str(error)


@app.get("/api/health")
def health():
    return {"ok": True, "threads": torch.get_num_threads(), "queue": sum(j["status"] == "queued" for j in jobs.values())}


@app.post("/api/jobs")
async def createJob(content: UploadFile = File(...), moodFile: UploadFile = File(..., alias="mood"),
                    iterations: int = Form(120), lightGrid: int = Form(8)):
    jobId = uuid.uuid4().hex[:12]
    folder = jobsDir / jobId
    folder.mkdir()
    contentPath, moodPath = folder / "content_in", folder / "mood_in"
    contentPath.write_bytes(await content.read())
    moodPath.write_bytes(await moodFile.read())
    for p, label in ((contentPath, "content"), (moodPath, "mood")):
        try:
            mood.loadImage(p, 64)
        except Exception:
            shutil.rmtree(folder, ignore_errors=True)
            raise HTTPException(400, f"The {label} file is not an image we can read.")
    settings = {"iterations": max(20, min(400, iterations)), "lightGrid": lightGrid if lightGrid in (0, 4, 8, 12) else 8}
    job = {"id": jobId, "status": "queued", "step": 0, "total": settings["iterations"], "losses": None,
           "history": [], "elapsed": 0, "eta": None, "error": None, "moodId": None, "cancel": False,
           "contentName": content.filename or "content", "moodName": moodFile.filename or "mood",
           "preview": None, "previewVersion": 0, "queuedAt": time.time(), "settings": settings, "size": None}
    with jobsLock:
        jobs[jobId] = job
    worker.submit(runJob, jobId, contentPath, moodPath)
    return publicJob(job)


@app.get("/api/jobs/{jobId}")
def getJob(jobId: str):
    job = jobs.get(jobId)
    if not job:
        raise HTTPException(404, "No such job.")
    return publicJob(job)


@app.post("/api/jobs/{jobId}/cancel")
def cancelJob(jobId: str):
    job = jobs.get(jobId)
    if not job:
        raise HTTPException(404, "No such job.")
    job["cancel"] = True
    if job["status"] == "queued":
        job["status"] = "cancelled"
    return publicJob(job)


@app.get("/api/jobs/{jobId}/preview.jpg")
def getPreview(jobId: str):
    job = jobs.get(jobId)
    if not job or not job.get("preview"):
        raise HTTPException(404, "No preview yet.")
    return Response(job["preview"], media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@app.get("/api/jobs/{jobId}/{name}")
def getJobFile(jobId: str, name: str):
    path = jobsDir / jobId / name
    if name not in allowedFiles or not path.exists():
        raise HTTPException(404, "File not found.")
    if name == "lut.cube":
        return FileResponse(path, media_type="text/plain", filename=f"mood_{jobId}.cube")
    return FileResponse(path)


@app.get("/api/moods")
def listMoods():
    items = []
    for d in moodsDir.iterdir():
        metaPath = d / "meta.json"
        if metaPath.exists():
            meta = json.loads(metaPath.read_text())
            meta.pop("lut", None)
            items.append(meta)
    items.sort(key=lambda m: m["createdAt"], reverse=True)
    return items


@app.get("/api/moods/{moodId}")
def getMood(moodId: str):
    metaPath = moodsDir / moodId / "meta.json"
    if not metaPath.exists():
        raise HTTPException(404, "No such mood.")
    return JSONResponse(json.loads(metaPath.read_text()))


@app.get("/api/moods/{moodId}/{name}")
def getMoodFile(moodId: str, name: str):
    path = moodsDir / moodId / name
    if name not in ("mood.jpg", "lut.cube") or not path.exists():
        raise HTTPException(404, "File not found.")
    return FileResponse(path)


@app.post("/api/moods/{moodId}/apply")
async def applyMood(moodId: str, image: UploadFile = File(...)):
    gradePath = moodsDir / moodId / "grade.pt"
    if not gradePath.exists():
        raise HTTPException(404, "No such mood.")
    try:
        img = mood.loadImage(io.BytesIO(await image.read()), 4000)
    except Exception:
        raise HTTPException(400, "That file is not an image we can read.")
    grade = torch.load(gradePath)
    result = mood.gradeFull(img, grade["lut"], grade["gain"])
    buf = io.BytesIO()
    result.save(buf, "PNG")
    return Response(buf.getvalue(), media_type="image/png")


# production mein frontend ka build bhi yahin se serve ho jata hai
distDir = rootDir.parent / "frontend" / "dist"
if distDir.exists():
    app.mount("/", StaticFiles(directory=distDir, html=True), name="frontend")
