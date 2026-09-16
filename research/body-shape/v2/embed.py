import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.environ['HF_HOME'] = str(ROOT / '.models')
os.environ['HF_HUB_DISABLE_XET'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
import numpy as np
import torch
from PIL import Image, ImageOps
from huggingface_hub import model_info
from transformers import CLIPModel


def main():
    torch.set_num_threads(4)
    model_name = 'openai/clip-vit-base-patch32'
    metadata_path = ROOT / 'embedding-model.json'
    revision = json.loads(metadata_path.read_text())['revision'] if metadata_path.exists() else model_info(model_name).sha
    model = CLIPModel.from_pretrained(model_name, revision=revision).eval()
    paths = sorted((ROOT / 'normalized').glob('*.jpg'))
    features = []
    mean = np.array([.48145466, .4578275, .40821073], dtype=np.float32)
    standard = np.array([.26862954, .26130258, .27577711], dtype=np.float32)
    with torch.inference_mode():
        for offset in range(0, len(paths), 16):
            batch = []
            for path in paths[offset:offset + 16]:
                picture = Image.open(path).convert('RGB')
                normalized = ImageOps.pad(picture, (224, 224), method=Image.Resampling.BICUBIC, color=(238, 238, 238))
                pixels = (np.asarray(normalized).astype(np.float32) / 255 - mean) / standard
                batch.append(np.transpose(pixels, (2, 0, 1)))
            encoded = model.get_image_features(pixel_values=torch.from_numpy(np.stack(batch)))
            if not isinstance(encoded, torch.Tensor):
                encoded = encoded.pooler_output
            encoded = torch.nn.functional.normalize(encoded, dim=-1)
            features.extend(encoded.numpy())
            print(f'{min(offset + 16, len(paths))}/{len(paths)}', flush=True)
    np.savez_compressed(ROOT / 'embeddings.npz', ids=np.array([path.stem for path in paths]), values=np.array(features))
    (ROOT / 'embedding-model.json').write_text(json.dumps(dict(model=model_name, revision=revision, preprocessing='grayscale segmented head-removed body crop, aspect-preserving square padding, CLIP normalization', dimensions=len(features[0]), count=len(paths)), indent=2))


if __name__ == '__main__':
    main()
