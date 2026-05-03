import os

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    reload = os.environ.get("DEVPOST_RELOAD", "1") not in ("0", "false", "False")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=reload)
