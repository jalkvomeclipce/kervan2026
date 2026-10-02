import time, shutil, sys
from gradio_client import Client, handle_file
t0 = time.time()
import os
c = Client('microsoft/TRELLIS.2', token=os.environ['HF_TOKEN'])
try: c.predict(api_name='/start_session')
except Exception as e: print('start_session:', e)
img = c.predict(handle_file('concept_crop.png'), api_name='/preprocess_image')
print('preprocessed', img, round(time.time() - t0, 1)); sys.stdout.flush()
res = sys.argv[1] if len(sys.argv) > 1 else '1024'
html = c.predict(handle_file(img['path'] if isinstance(img, dict) else img), 42, res, api_name='/image_to_3d')
print('generated', round(time.time() - t0, 1), str(html)[:200]); sys.stdout.flush()
glb, dl = c.predict(100000, 2048, api_name='/extract_glb')
print('glb', glb, dl)
shutil.copy(dl if dl else glb, 'trellis_raw.glb')
print('done', round(time.time() - t0, 1))
