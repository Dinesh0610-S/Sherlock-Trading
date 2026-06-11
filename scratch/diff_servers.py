import difflib

def diff_files(file1, file2, out_name):
    try:
        with open(file1, "r", encoding="utf-8") as f1, open(file2, "r", encoding="utf-8") as f2:
            lines1 = f1.readlines()
            lines2 = f2.readlines()
        diff = list(difflib.unified_diff(lines1, lines2, fromfile=file1, tofile=file2, n=3))
        if diff:
            with open(f"scratch/{out_name}", "w", encoding="utf-8") as out:
                out.writelines(diff)
            print(f"Saved diff for {file1} -> {file2} (size: {len(diff)} lines)")
        else:
            print(f"No diff for {file1} -> {file2}")
    except Exception as e:
        print(f"Error diffing {file1} and {file2}: {e}")

diff_files("server.js.bak", "server.js", "server_diff.txt")
diff_files("proxy.js.bak", "proxy.js", "proxy_diff.txt")
