import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Let's count standard braces { and } outside of strings and comments
open_count = 0
close_count = 0
in_string = False
string_char = None
in_comment = False
comment_type = None # 'single' or 'multi'

i = 0
line_no = 1
col_no = 1
stack = [] # Store line, col, index of {

while i < len(content):
    char = content[i]
    if char == '\n':
        line_no += 1
        col_no = 1
        if in_comment and comment_type == 'single':
            in_comment = False
            comment_type = None
    else:
        col_no += 1

    if in_comment:
        if comment_type == 'multi' and char == '*' and i + 1 < len(content) and content[i+1] == '/':
            in_comment = False
            comment_type = None
            i += 2
            continue
        i += 1
        continue

    if in_string:
        # Check escape char
        if char == '\\':
            i += 2
            continue
        if char == string_char:
            in_string = False
            string_char = None
        i += 1
        continue

    # Check comments
    if char == '/' and i + 1 < len(content) and content[i+1] == '/':
        in_comment = True
        comment_type = 'single'
        i += 2
        continue
    if char == '/' and i + 1 < len(content) and content[i+1] == '*':
        in_comment = True
        comment_type = 'multi'
        i += 2
        continue

    # Check strings
    if char in ["'", '"', '`']:
        in_string = True
        string_char = char
        i += 1
        continue

    if char == '{':
        open_count += 1
        stack.append((line_no, col_no, i))
    elif char == '}':
        close_count += 1
        if len(stack) > 0:
            stack.pop()
        else:
            print(f"Extra closing brace at Line {line_no}, Col {col_no}")

    i += 1

print(f"Total opening braces: {open_count}")
print(f"Total closing braces: {close_count}")
print(f"Brace balance: {open_count - close_count}")
if len(stack) > 0:
    print("Unclosed braces:")
    for item in stack[-10:]:
        print(f"Unclosed {{ at Line {item[0]}, Col {item[1]}")
