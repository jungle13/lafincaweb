import os
import re

css_path = 'app/css/style.css'
html_path = 'app/index.html'

def replace_colors(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Reemplazos de Azul a Naranja
    content = re.sub(r'rgba\(\s*59\s*,\s*130\s*,\s*246', 'rgba(249, 115, 22', content)
    content = re.sub(r'#3b82f6', '#f97316', content, flags=re.IGNORECASE)
    content = re.sub(r'#60a5fa', '#fb923c', content, flags=re.IGNORECASE)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

replace_colors(css_path)
replace_colors(html_path)
print("Colors updated successfully.")
