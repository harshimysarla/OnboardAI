import os

BASE = r"C:\wse\OnboardAI"

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Written: {path}")

# Select component
write("src/components/ui/select.tsx", """import { cn } from "@/lib/utils";

interface SelectProps