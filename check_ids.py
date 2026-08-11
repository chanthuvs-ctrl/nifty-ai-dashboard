import re

with open("static/index.html") as f:
    html = f.read()

with open("static/script.js") as f:
    js = f.read()

print("=== Spot price element IDs in index.html ===")
matches_html = re.findall(r'id=["\']([^"\']*spot[^"\']*)["\']', html, re.IGNORECASE)
print("HTML IDs:", set(matches_html))

print("\n=== Spot price element IDs looked up in script.js ===")
matches_js = re.findall(r'getElementById\(["\']([^"\']*spot[^"\']*)["\']\)', js, re.IGNORECASE)
print("JS IDs:", set(matches_js))
