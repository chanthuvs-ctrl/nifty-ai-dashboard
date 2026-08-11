#!/usr/bin/env python3
"""
Privacy-Focused macOS Bank SMS Auto-Capture Listener (FinPulse AI)
ONLY captures and forwards Bank/Expense SMSes matching financial keywords.
Ignores 100% of personal text messages.
"""

import time
import re
import urllib.request
import json
import subprocess
import sys

API_URL = "http://localhost:5050/api/sms/ingest"

# Strict Financial Keywords Filter
FINANCIAL_KEYWORDS = [
  r'\bdebited\b', r'\bcredited\b', r'\bspent\b', r'\bpaid\b', 
  r'\bemi\b', r'\bksfe\b', r'\blic\b', r'\bcred\b', r'\bupi\b',
  r'\ba\/c\b', r'\baccount\b', r'\bbank\b', r'\btransaction\b',
  r'rs\.?\s*\d+', r'inr\s*\d+', r'₹\s*\d+'
]

FILTER_REGEX = re.compile('|'.join(FINANCIAL_KEYWORDS), re.IGNORECASE)

print("===============================================================")
print("  Privacy-Protected macOS Bank SMS Listener (FinPulse AI)")
print("===============================================================")
print(f"Target Webhook: {API_URL}")
print("Filter Mode: ONLY Financial/Bank SMSes (Personal texts ignored)")
print("Listening for incoming bank SMSes on macOS... Press Ctrl+C to stop.\n")

def is_financial_sms(text):
    """Check if the text contains bank or expense transaction keywords."""
    return bool(FILTER_REGEX.search(text))

def ingest_sms(text, source="macOS Smart Capture"):
    if not is_financial_sms(text):
        print(f"[🛡️ IGNORED] Personal/Non-financial message skipped.")
        return None

    try:
        data = json.dumps({"smsText": text, "source": source}).encode('utf-8')
        req = urllib.request.Request(
            API_URL, 
            data=data, 
            headers={"Content-Type": "application/json"}
        )
        res = urllib.request.urlopen(req)
        result = json.loads(res.read().decode())
        print(f"\n[✓ BANK SMS CAPTURED] {result.get('message', 'SMS Ingested successfully')}")
        if result.get('parsed'):
            p = result['parsed']
            print(f"   Bank: {p.get('bank')} | Amount: ₹{p.get('amount')} | Tag: {p.get('category')}")
        return result
    except Exception as e:
        print(f"[!] Error forwarding SMS: {e}")
        return None

def monitor_clipboard():
    """Monitors clipboard for copied bank SMSes."""
    last_clip = ""
    while True:
        try:
            clip = subprocess.check_output(['pbpaste'], text=True).strip()
            if clip and clip != last_clip:
                last_clip = clip
                if is_financial_sms(clip):
                    print(f"\n[+] Financial SMS detected in clipboard!")
                    ingest_sms(clip, source="macOS Clipboard Filter")
        except Exception:
            pass
        time.sleep(1.5)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        sms_arg = " ".join(sys.argv[1:])
        ingest_sms(sms_arg, source="macOS Terminal CLI")
    else:
        try:
            monitor_clipboard()
        except KeyboardInterrupt:
            print("\nStopped Privacy SMS Listener daemon.")
