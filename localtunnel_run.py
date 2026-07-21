import asyncio
import sys
from localtunnel.tunnel_manager import TunnelManager

async def run_tunnel():
    manager = TunnelManager()
    # Explicitly print and run
    print("Connecting to localtunnel.me server...")
    manager.add_tunnel(port=8000, subdomain=None, host="https://localtunnel.me")
    
    try:
        await manager.open_all()
    except Exception as e:
        print(f"✗ Failed to open tunnel: {e}")
        return

    # Wait a bit to ensure URLs are registered
    await asyncio.sleep(1.0)
    
    urls = [t.get_tunnel_url() for t in manager.tunnels if t.get_tunnel_url()]
    if not urls or not urls[0]:
        print("✗ Tunnel connected, but failed to retrieve public URL.")
        return
        
    url = urls[0]
    print("\n==========================================================")
    print(f"🚀 YOUR PUBLIC TUNNEL LINK: {url}")
    print("COPY AND OPEN THE ABOVE HTTPS LINK ON YOUR MOBILE")
    print("==========================================================\n")
    
    try:
        # Keep running
        while True:
            await asyncio.sleep(3600)
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass
    finally:
        print("Closing tunnel...")
        await manager.close_all()

if __name__ == "__main__":
    try:
        asyncio.run(run_tunnel())
    except KeyboardInterrupt:
        print("\nTunnel closed.")
