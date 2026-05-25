#!/usr/bin/env python3
"""
OpenCV panorama stitcher for Biz360 API server.
Usage:  python3 stitch.py '["path1.jpg","path2.jpg",...]'
Output: JSON  {"panorama":"<base64 JPEG>","haov":<deg>,"vaov":<deg>,"stitched":<bool>}
Errors: non-zero exit + message on stderr
"""
import sys, json, base64, cv2, numpy as np

MAX_W = 1400
JPEG_QUALITY = 88


def resize_max(img):
    h, w = img.shape[:2]
    if w <= MAX_W:
        return img
    return cv2.resize(img, (MAX_W, int(h * MAX_W / w)), interpolation=cv2.INTER_AREA)


def crop_black(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 2, 255, cv2.THRESH_BINARY)
    coords = cv2.findNonZero(mask)
    if coords is None:
        return img
    x, y, w, h = cv2.boundingRect(coords)
    pad = 4
    y1 = max(0, y + pad)
    y2 = min(img.shape[0], y + h - pad)
    x1 = max(0, x + pad)
    x2 = min(img.shape[1], x + w - pad)
    return img[y1:y2, x1:x2] if y2 > y1 and x2 > x1 else img


def concat_fallback(imgs):
    target_h = min(i.shape[0] for i in imgs)
    strips = []
    for i in imgs:
        h, w = i.shape[:2]
        new_w = int(w * target_h / h)
        strips.append(cv2.resize(i, (new_w, target_h), interpolation=cv2.INTER_AREA))
    return np.hstack(strips)


def to_base64(img):
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    return base64.b64encode(bytes(buf)).decode("ascii")


def run(paths):
    imgs = []
    for p in paths:
        img = cv2.imread(p)
        if img is not None:
            imgs.append(resize_max(img))
        else:
            sys.stderr.write(f"Warning: could not read {p}\n")

    if not imgs:
        raise ValueError("No images could be loaded")

    n = len(imgs)

    if n == 1:
        return {"panorama": to_base64(imgs[0]), "haov": 70, "vaov": 55, "stitched": False}

    stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
    stitcher.setPanoConfidenceThresh(0.3)

    status, pano = stitcher.stitch(imgs)

    if status == cv2.Stitcher_OK:
        pano = crop_black(pano)
        h, w = pano.shape[:2]
        haov = min(360, round((w / max(h, 1)) * 90))
        vaov = min(120, round((h / max(w, 1)) * 180))
        return {"panorama": to_base64(pano), "haov": haov, "vaov": max(vaov, 40), "stitched": True}
    else:
        codes = {
            cv2.Stitcher_ERR_NEED_MORE_IMGS: "need_more_images",
            cv2.Stitcher_ERR_HOMOGRAPHY_EST_FAIL: "homography_failed",
            cv2.Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL: "camera_params_failed",
        }
        sys.stderr.write(f"Stitcher failed: {codes.get(status, status)} — using fallback\n")
        concat = concat_fallback(imgs)
        haov = min(360, n * 70)
        return {"panorama": to_base64(concat), "haov": haov, "vaov": 55, "stitched": False}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: stitch.py '[\"path1\",\"path2\",...]\'\n")
        sys.exit(1)
    try:
        paths = json.loads(sys.argv[1])
        result = run(paths)
        json.dump(result, sys.stdout)
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"ERROR: {e}\n")
        sys.exit(1)
