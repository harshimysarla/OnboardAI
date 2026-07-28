import os, base64, sys
BASE = r"C:\wse\OnboardAI"
def w(path, b64):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'wb') as f:
        f.write(base64.b64decode(b64))
    print(f"Written: {path}")

# UI Components
w("src/components/ui/empty-state.tsx", "ZXhwb3J0IGZ1bmN