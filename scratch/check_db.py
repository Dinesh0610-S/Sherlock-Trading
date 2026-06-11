import sqlite3
import os

exclude_dirs = { 'node_modules', 'dist', '.git', '.zenflow', '.zencoder', '__pycache__' }

def check_db(file_path):
    print('Checking database:', file_path)
    try:
        conn = sqlite3.connect(file_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        for table_tuple in tables:
            table = table_tuple[0]
            cursor.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            print(f"  Table {table} has {len(rows)} rows")
            for row in rows:
                row_str = str(row)
                if '3036' in row_str:
                    print(f"    FOUND 3036 in row: {row}")
        conn.close()
    except Exception as e:
        print("  Error:", e)

# Check db files in root
for f in os.listdir('.'):
    if f.endswith('.db'):
        check_db(f)

# Check db files in backend
backend_dir = r"backend"
if os.path.exists(backend_dir):
    for f in os.listdir(backend_dir):
        if f.endswith('.db'):
            check_db(os.path.join(backend_dir, f))
