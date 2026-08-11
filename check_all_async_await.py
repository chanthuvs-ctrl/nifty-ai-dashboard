with open("static/script.js", "r") as f:
    js = f.read()

import re

# Find functions containing await
lines = js.splitlines()
in_func = None
func_is_async = False
func_start_line = 0

errors = []

for idx, line in enumerate(lines, 1):
    fn_match = re.search(r'function\s+([a-zA-Z0-9_]+)\s*\(', line)
    async_fn_match = re.search(r'async\s+function\s+([a-zA-Z0-9_]+)\s*\(', line)
    
    if async_fn_match:
        in_func = async_fn_match.group(1)
        func_is_async = True
        func_start_line = idx
    elif fn_match:
        in_func = fn_match.group(1)
        func_is_async = False
        func_start_line = idx
        
    if 'await ' in line and not func_is_async:
        errors.append((idx, in_func, line.strip()))

print("=== Scanning script.js for 'await' inside non-async functions ===")
if errors:
    print(f"FOUND {len(errors)} FATAL JAVASCRIPT SYNTAX ERRORS:")
    for err in errors:
        print(f"  • Line {err[0]} in function '{err[1]}': {err[2]}")
else:
    print("No non-async await errors found.")
