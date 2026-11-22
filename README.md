# Mood Transfer

Term project for CS4055 Digital Image Processing, FAST NUCES Lahore, Fall 2026.

Group:
- Muhammad Shuja Jamal, 23L-3024
- Hassaan bin Saqib, 23L-3039

Give it two photos, a content photo and a mood photo, and it re-grades the content photo so it carries the look and feel of the mood photo (colour palette, tone, warmth, light falloff) while it still stays a real photograph.

## Idea in one line

VGG-19 is used as a judge, not as a painter. We do not let a network repaint pixels (that is how normal neural style transfer ends up looking like a painting). Instead we learn a small colour grade, a 3D LUT plus a smooth light grid, and keep tuning it until VGG-19 says the graded photo feels like the mood photo.

## Method

1. Both photos are shrunk to 256 px for the optimisation.
2. The grade has two parts:
   - a 17 x 17 x 17 **3D LUT** (every input colour maps to an output colour, trilinear interpolation in between),
   - an 8 x 8 **light grid** of log gains, bicubic upsampled, so the grade can brighten or darken regions (vignette, glow, falloff).
3. The LUT starts from the classical Reinhard transfer instead of identity, so it converges faster.
4. Loss, all through a pretrained VGG-19:
   - **style**: Gram matrices at relu1_1, relu2_1, relu3_1, relu4_1 vs the mood photo,
   - **colour**: sliced Wasserstein distance between the two pixel colour distributions (random projections, sort, compare),
   - **content**: relu4_2 features vs the original content photo, so the scene does not drift,
   - **regularisers**: LUT smoothness, LUT monotonicity (colours never flip) and light grid smoothness.
5. Adam for 60 to 200 steps. Then the learned LUT and light grid are applied to the full size photo, which takes about a second because the grade does not care about resolution.

The learned mood is saved, so it can be applied to any other photo without running VGG-19 again, and it can be downloaded as a standard `.cube` LUT that opens in Photoshop, Premiere or DaVinci Resolve.

**Baseline:** Reinhard et al. 2001, mean and standard deviation matching in the l alpha beta colour space. The app shows it next to our result.

### What we added on top of the usual approaches

- Learning a parametric grade (LUT plus light grid) with neural losses, instead of optimising pixels (Gatys) or training a style network.
- The sliced Wasserstein colour loss next to the Gram style loss.
- Warm starting the LUT from the Reinhard transfer.
- Exporting the mood as `.cube` and reusing saved moods on new photos.

## Project layout

```
backend/
  app/mood.py       the algorithm: LUT, light grid, losses, Reinhard baseline, .cube export
  app/main.py       FastAPI server: job queue, progress, files, mood library
  requirements.txt
frontend/
  src/              React + Vite + TypeScript app (Print, Library, Method views)
start.bat           Windows launcher (starts backend + frontend)
```

## Running it

Needs Python 3.12 and Node 20 or newer. No GPU needed, everything runs on the CPU.

### One-click start (Windows)

Double-click `start.bat` (or run `.\start.bat` in a terminal). It checks dependencies, launches both backend and frontend servers, and opens the app at http://localhost:5173.

### Manual start

Backend:

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # on Linux or Mac: source .venv/bin/activate
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
uvicorn app.main:app --port 8000
```

The first run downloads the VGG-19 ImageNet weights (about 550 MB) into the torch cache.

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server forwards `/api` to the backend on port 8000.

For a single server (for example when deploying), build the frontend with `npm run build`. The backend then serves `frontend/dist` itself, so only `uvicorn app.main:app --port 8000` is needed and the app is at http://localhost:8000.

## Using it

- **Print**: load a content photo and a mood photo, pick a quality, press Expose. Frames show up on the contact sheet while the grade develops. When it is done, pick a strength from the test strip, flip between Graded, Reinhard baseline, Original and Split, and download the print, the `.cube` LUT or the baseline.
- **Library**: every finished run is saved as a mood. Pick one and print any photo with it in about a second.
- **Method**: a short write up of the method for the viva.

## Sample pairs

The Print view has three ready made pairs (cat photos as content, skies as mood) so the demo works without hunting for photos:

- window tabby + sunrise clouds
- cat portrait + magenta aurora
- garden tabby + blue hour

All six photos are CC0 (public domain dedication), found through Openverse. Sources and authors are listed in `frontend/public/samples/CREDITS.md`.

## API

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/api/jobs` | start a run (`content`, `mood`, `iterations`, `lightGrid`) |
| GET | `/api/jobs/{id}` | status, step, losses, eta |
| GET | `/api/jobs/{id}/preview.jpg` | latest developing frame |
| GET | `/api/jobs/{id}/result.png` | full size result (also `result.jpg`, `baseline.png`, `lut.cube`) |
| POST | `/api/jobs/{id}/cancel` | stop a run |
| GET | `/api/moods` | saved moods |
| POST | `/api/moods/{id}/apply` | print a new photo with a saved mood |

## References

- E. Reinhard, M. Ashikhmin, B. Gooch, P. Shirley. Color Transfer between Images. IEEE CG&A, 2001.
- L. Gatys, A. Ecker, M. Bethge. Image Style Transfer Using Convolutional Neural Networks. CVPR 2016.
- F. Luan, S. Paris, E. Shechtman, K. Bala. Deep Photo Style Transfer. CVPR 2017.
- H. Zeng, J. Cai, L. Li, Z. Cao, L. Zhang. Learning Image-adaptive 3D Lookup Tables for High Performance Photo Enhancement. TPAMI 2020.
- E. Heitz, K. Vanhoey, T. Chambon, L. Belcour. A Sliced Wasserstein Loss for Neural Texture Synthesis. CVPR 2021.
- K. Simonyan, A. Zisserman. Very Deep Convolutional Networks for Large-Scale Image Recognition. ICLR 2015.
