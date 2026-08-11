import { useState } from 'react';
import { Mail, Download } from 'lucide-react';
import jsPDF from 'jspdf';

export default function OfferLetterGenerator() {
  const [candidateName, setCandidateName] = useState('');
  const [designation, setDesignation] = useState('Staff Nurse');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [salary, setSalary] = useState('');

  const generatePDF = () => {
    if (!candidateName || !salary) return;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('DE NATURA CLINIC', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Healthcare & Aesthetic Care Center', 105, 27, { align: 'center' });
    doc.line(20, 32, 190, 32);

    doc.setFontSize(14);
    doc.text('OFFER LETTER', 105, 45, { align: 'center' });

    doc.setFontSize(11);
    doc.text('Date: ' + new Date().toLocaleDateString(), 150, 55);
    doc.text('To,', 20, 65);
    doc.text(candidateName, 20, 72);

    const bodyText = `Dear ${candidateName},

We are pleased to offer you the position of ${designation} at De Natura Clinic. We were impressed with your qualifications and experience and believe you will be a valuable addition to our team.

Key Terms of Employment:
• Position / Title: ${designation}
• Offered Monthly Base Salary: ₹${parseFloat(salary).toLocaleString()}
• Expected Joining Date: ${joiningDate}

Please review and sign below to accept this formal offer.

Warm regards,
De Natura Clinic Management`;

    const splitText = doc.splitTextToSize(bodyText, 170);
    doc.text(splitText, 20, 85);

    doc.text('Candidate Signature: __________________', 20, 220);
    doc.text('Authorized Signature: __________________', 120, 220);

    doc.save('Offer_Letter_' + candidateName.replace(/\s+/g, '_') + '.pdf');
  };

  return (
    <div className='glass-panel p-8 rounded-2xl border border-slate-800 space-y-6'>
      <div className='flex items-center gap-3 border-b border-slate-800/80 pb-4'>
        <div className='w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20'>
          <Mail size={20} />
        </div>
        <div>
          <h2 className='text-lg font-bold text-white tracking-tight'>Generate Formal Offer Letter</h2>
          <p className='text-xs text-slate-400'>Issue formatted appointment documents for new clinical & admin hires.</p>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
        <div>
          <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>Candidate Full Name</label>
          <input type='text' placeholder='e.g. Anjali Nair' value={candidateName} onChange={e => setCandidateName(e.target.value)} required className='w-full p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition' />
        </div>
        <div>
          <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>Designation / Role</label>
          <input type='text' placeholder='e.g. Staff Nurse / Aesthetic Specialist' value={designation} onChange={e => setDesignation(e.target.value)} required className='w-full p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition' />
        </div>
        <div>
          <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>Offered Base Monthly Salary (₹)</label>
          <input type='number' placeholder='e.g. 18000' value={salary} onChange={e => setSalary(e.target.value)} required className='w-full p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition' />
        </div>
        <div>
          <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>Joining Date</label>
          <input type='date' value={joiningDate} onChange={e => setJoiningDate(e.target.value)} required className='w-full p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition' />
        </div>
      </div>

      <div className='text-right pt-2'>
        <button onClick={generatePDF} className='py-3 px-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 text-xs transition inline-flex items-center gap-2'>
          <Download size={16} /> Download Offer Letter PDF
        </button>
      </div>
    </div>
  );
}
