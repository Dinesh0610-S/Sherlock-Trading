import ast
import sys

sys.stdout.reconfigure(encoding="utf-8")

file_path = "backend/ai_advisory.py"

with open(file_path, "r", encoding="utf-8") as f:
    tree = ast.parse(f.read())

class Visitor(ast.NodeVisitor):
    def visit_FunctionDef(self, node):
        print(f"Function: {node.name} (line {node.lineno})")
        doc = ast.get_docstring(node)
        if doc:
            first_line = doc.split("\n")[0]
            print(f"  Docstring: {first_line}")
        # Search for any comments inside the function body
        # (ast doesn't contain comments, we will search lines later)

Visitor().visit(tree)
