filepath = 'clinic-app/src/data/realTransactions.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

august_entries = ''',
  {"id": "real_in_6938", "date": "2026-08-01", "type": "Income", "category": "con", "patientName": "Deepu Mon", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 300.0, "description": "Service: Consultation (Acne Scars)", "createdAt": 6938},
  {"id": "real_in_6939", "date": "2026-08-01", "type": "Income", "category": "peel", "patientName": "Deepu Mon", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 1500.0, "description": "Service: Chemical Peel", "createdAt": 6939},
  {"id": "real_in_6940", "date": "2026-08-02", "type": "Income", "category": "con", "patientName": "Muhammed Fayis", "doctorName": "Dr Anagha S Nath", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 300.0, "description": "Service: Consultation (Hair Transplant)", "createdAt": 6940},
  {"id": "real_in_6941", "date": "2026-08-03", "type": "Income", "category": "con", "patientName": "Anaswara MS", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["Cash"], "amount": 300.0, "description": "Service: Consultation (Hair Fall)", "createdAt": 6941},
  {"id": "real_in_6942", "date": "2026-08-03", "type": "Income", "category": "PRP", "patientName": "Anaswara MS", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["Cash"], "amount": 3500.0, "description": "Service: PRP Hair Session", "createdAt": 6942},
  {"id": "real_in_6943", "date": "2026-08-04", "type": "Income", "category": "con", "patientName": "Aadhithyan A S", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 300.0, "description": "Service: Consultation (Acne Marks)", "createdAt": 6943},
  {"id": "real_in_6944", "date": "2026-08-04", "type": "Income", "category": "med", "patientName": "Aadhithyan A S", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 1200.0, "description": "Service: Skincare Medicines", "createdAt": 6944},
  {"id": "real_in_6945", "date": "2026-08-05", "type": "Income", "category": "con", "patientName": "Deepak S", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["Cash"], "amount": 300.0, "description": "Service: Consultation", "createdAt": 6945},
  {"id": "real_in_6946", "date": "2026-08-06", "type": "Income", "category": "con", "patientName": "Faisal V S", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 300.0, "description": "Service: Consultation (PRP GFC)", "createdAt": 6946},
  {"id": "real_in_6947", "date": "2026-08-06", "type": "Income", "category": "GFC", "patientName": "Faisal V S", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 5000.0, "description": "Service: Advanced GFC Therapy", "createdAt": 6947},
  {"id": "real_in_6948", "date": "2026-08-07", "type": "Income", "category": "con", "patientName": "Sreekumar", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 300.0, "description": "Service: Hair Fall Consultation", "createdAt": 6948},
  {"id": "real_in_6949", "date": "2026-08-07", "type": "Income", "category": "med", "patientName": "Sreekumar", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 2800.0, "description": "Service: Trichology Medicines", "createdAt": 6949},
  {"id": "real_in_6950", "date": "2026-08-08", "type": "Income", "category": "peel", "patientName": "Reshma Nair", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["Card"], "amount": 1800.0, "description": "Service: Glow Peel Session", "createdAt": 6950},
  {"id": "real_in_6951", "date": "2026-08-09", "type": "Income", "category": "con", "patientName": "Vishnu S R", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 300.0, "description": "Service: Followup Consultation", "createdAt": 6951},
  {"id": "real_in_6952", "date": "2026-08-10", "type": "Income", "category": "GFC", "patientName": "Arun s Nair", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 5000.0, "description": "Service: GFC Hair Session", "createdAt": 6952},
  {"id": "real_in_6953", "date": "2026-08-11", "type": "Income", "category": "Ad Convert Package", "patientName": "Cifin Kc", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["GPay"], "amount": 3374.0, "description": "Service: Hair Package (Ad Convert)", "createdAt": 6953},
  {"id": "real_in_6954", "date": "2026-08-12", "type": "Income", "category": "con", "patientName": "Prasanth GS", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["Cash"], "amount": 300.0, "description": "Service: Consultation", "createdAt": 6954},
  {"id": "real_in_6955", "date": "2026-08-12", "type": "Income", "category": "med", "patientName": "Prasanth GS", "doctorName": "Dr Deepthy R K", "doctorAllowance": 0.0, "paymentMethods": ["Cash"], "amount": 1450.0, "description": "Service: Skincare Medicines", "createdAt": 6955}
]'''

if 'real_in_6955' not in content:
    content = content.replace('{"id": "real_in_6937", "date": "2026-07-31", "type": "Income", "category": "med", "patientName": "Sibil", "doctorName": "", "doctorAllowance": 0.0, "paymentMethods": ["Cash"], "amount": 1170.0, "description": "Service: med", "createdAt": 6936}];', '{"id": "real_in_6937", "date": "2026-07-31", "type": "Income", "category": "med", "patientName": "Sibil", "doctorName": "", "doctorAllowance": 0.0, "paymentMethods": ["Cash"], "amount": 1170.0, "description": "Service: med", "createdAt": 6936}' + august_entries + ';')
    content = content.replace('{"id": "real_in_6937", "date": "2026-07-31", "type": "Income", "category": "med", "patientName": "Sibil", "doctorName": "", "doctorAllowance": 0.0, "paymentMethods": ["Cash"], "amount": 1170.0, "description": "Service: med", "createdAt": 6937}];', '{"id": "real_in_6937", "date": "2026-07-31", "type": "Income", "category": "med", "patientName": "Sibil", "doctorName": "", "doctorAllowance": 0.0, "paymentMethods": ["Cash"], "amount": 1170.0, "description": "Service: med", "createdAt": 6937}' + august_entries + ';')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("August entries appended to realTransactions.ts!")
