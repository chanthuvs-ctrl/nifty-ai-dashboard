with open("static/script.js") as f:
    js = f.read()

pos = js.find("function fetchMarketData")
if pos != -1:
    print(js[pos:pos+1500])
