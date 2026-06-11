import sqlite3

def main():
    conn = sqlite3.connect('backend/asset_universe.db')
    cursor = conn.cursor()
    
    print("TABLE SCHEMA:")
    columns = cursor.execute("PRAGMA table_info(stocks)").fetchall()
    for col in columns:
        print(col)
        
    print("\nSAMPLE ROWS:")
    rows = cursor.execute("SELECT * FROM stocks LIMIT 10").fetchall()
    for row in rows:
        print(row)
        
    conn.close()

if __name__ == '__main__':
    main()
