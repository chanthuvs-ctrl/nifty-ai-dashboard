import React, { useState } from 'react';
import { 
  User, Mail, Award, FileText, Upload, 
  Trash2, Download, Check, Lock, X, CreditCard
} from 'lucide-react';

export interface DocumentItem {
  id: string;
  title: string;
  category: 'Certificate' | 'Resume' | 'ID Proof' | 'Other';
  fileUrl: string; // Base64 or Data URL
  fileName: string;
  fileType: string;
  uploadedAt: string;
}

export interface EmployeeProfileData {
  uid: string;
  name: string;
  role: string;
  email: string;
  department: string;
  basicSalary: number;
  joiningDate: string;
  phone?: string;
  emergencyContact?: string;
  bloodGroup?: string;
  address?: string;
  photoUrl?: string;
  medicalRegistrationNo?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  documents?: DocumentItem[];
  notes?: string;
}

interface Props {
  profile: EmployeeProfileData;
  isEditable: boolean;
  onSave?: (updated: EmployeeProfileData) => void;
  onClose?: () => void;
}

export default function EmployeeProfileView({ profile, isEditable, onSave, onClose }: Props) {
  const [formData, setFormData] = useState<EmployeeProfileData>({
    phone: '+91 8137093028',
    emergencyContact: '+91 9447000000',
    bloodGroup: 'O+ Positive',
    address: 'Thiruvananthapuram, Kerala, India',
    photoUrl: '',
    medicalRegistrationNo: 'KMC-' + Math.floor(10000 + Math.random() * 90000),
    bankName: 'HDFC Bank / SBI',
    accountNumber: 'XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000),
    ifscCode: 'HDFC0001234',
    documents: [],
    notes: 'Official verified staff member of De Natura Aesthetics.',
    ...profile
  });

  const [activeTab, setActiveTab] = useState<'info' | 'documents' | 'bank'>('info');
  const [isSaving, setIsSaving] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<'Certificate' | 'Resume' | 'ID Proof' | 'Other'>('Certificate');

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditable || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setFormData(prev => ({ ...prev, photoUrl: String(evt.target?.result) }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Document / Certificate / Resume Upload
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditable || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const title = docTitle.trim() || file.name;

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        const newDoc: DocumentItem = {
          id: 'doc_' + Date.now(),
          title: title,
          category: docCategory,
          fileUrl: String(evt.target.result),
          fileName: file.name,
          fileType: file.type,
          uploadedAt: new Date().toLocaleDateString('en-GB')
        };

        setFormData(prev => ({
          ...prev,
          documents: [newDoc, ...(prev.documents || [])]
        }));
        setDocTitle('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDoc = (id: string) => {
    if (!isEditable) return;
    if (!window.confirm('Are you sure you want to remove this document?')) return;
    setFormData(prev => ({
      ...prev,
      documents: (prev.documents || []).filter(d => d.id !== id)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable || !onSave) return;
    setIsSaving(true);
    onSave(formData);
    setTimeout(() => setIsSaving(false), 600);
  };

  return (
    <div className='glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6 text-slate-100 max-w-4xl w-full mx-auto relative'>
      {/* Header Banner */}
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-6 gap-4'>
        <div className='flex items-center gap-4'>
          <div className='relative group'>
            {formData.photoUrl ? (
              <img 
                src={formData.photoUrl} 
                alt={formData.name} 
                className='w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-cyan-500/40 shadow-lg shadow-cyan-500/20'
              />
            ) : (
              <div className='w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border-2 border-cyan-500/40 flex items-center justify-center text-cyan-400 font-extrabold text-2xl shadow-lg shadow-cyan-500/10'>
                {formData.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            {isEditable && (
              <label className='absolute -bottom-1 -right-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 p-1.5 rounded-lg cursor-pointer shadow-md transition'>
                <Upload size={14} />
                <input type='file' accept='image/*' className='hidden' onChange={handlePhotoUpload} />
              </label>
            )}
          </div>

          <div>
            <div className='flex items-center gap-2'>
              <h2 className='text-xl sm:text-2xl font-black text-white tracking-tight'>{formData.name}</h2>
              {!isEditable && (
                <span className='px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1'>
                  <Lock size={12} /> Read-Only
                </span>
              )}
            </div>
            <p className='text-xs text-cyan-400 font-semibold mt-0.5'>{formData.role} • {formData.department}</p>
            <p className='text-xs text-slate-400 mt-1 flex items-center gap-1.5'>
              <Mail size={12} /> {formData.email}
            </p>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className='p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800'
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className='flex border-b border-slate-800 gap-2 text-xs font-bold'>
        <button
          onClick={() => setActiveTab('info')}
          className={'pb-3 px-4 flex items-center gap-2 border-b-2 transition ' + (activeTab === 'info' ? 'border-cyan-400 text-cyan-400 font-black' : 'border-transparent text-slate-400 hover:text-slate-200')}
        >
          <User size={14} /> Personal & Qualifications
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={'pb-3 px-4 flex items-center gap-2 border-b-2 transition ' + (activeTab === 'documents' ? 'border-cyan-400 text-cyan-400 font-black' : 'border-transparent text-slate-400 hover:text-slate-200')}
        >
          <Award size={14} /> Certificates & Resume ({formData.documents?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={'pb-3 px-4 flex items-center gap-2 border-b-2 transition ' + (activeTab === 'bank' ? 'border-cyan-400 text-cyan-400 font-black' : 'border-transparent text-slate-400 hover:text-slate-200')}
        >
          <CreditCard size={14} /> Bank & Payroll Info
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className='space-y-6'>
        {activeTab === 'info' && (
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs'>
            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Full Name</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Official Email</label>
              <input
                type='email'
                disabled={!isEditable}
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Designation / Role</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Department</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Phone Number</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Emergency Contact</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.emergencyContact || ''}
                onChange={e => setFormData({ ...formData, emergencyContact: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Medical / Registration No.</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.medicalRegistrationNo || ''}
                onChange={e => setFormData({ ...formData, medicalRegistrationNo: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Blood Group</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.bloodGroup || ''}
                onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div className='sm:col-span-2'>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Residential Address</label>
              <textarea
                rows={2}
                disabled={!isEditable}
                value={formData.address || ''}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className='space-y-6 text-xs'>
            {/* Document Uploader (Admin Only) */}
            {isEditable ? (
              <div className='p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3'>
                <h4 className='font-bold text-white flex items-center gap-2'>
                  <Upload size={16} className='text-cyan-400' /> Upload Employee Certificate, Resume, or Document
                </h4>

                <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                  <input
                    type='text'
                    placeholder='Document Title (e.g., Nursing Degree, Resume 2026, Aadhaar)'
                    value={docTitle}
                    onChange={e => setDocTitle(e.target.value)}
                    className='p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400'
                  />

                  <select
                    value={docCategory}
                    onChange={e => setDocCategory(e.target.value as any)}
                    className='p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-semibold'
                  >
                    <option value='Certificate'>Certificate / Degree</option>
                    <option value='Resume'>Resume / CV</option>
                    <option value='ID Proof'>ID Proof / Aadhaar / PAN</option>
                    <option value='Other'>Other Official Record</option>
                  </select>

                  <label className='py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-cyan-500/20'>
                    <Upload size={14} /> Attach & Upload File
                    <input type='file' accept='.pdf,image/*,.doc,.docx' className='hidden' onChange={handleDocumentUpload} />
                  </label>
                </div>
              </div>
            ) : (
              <div className='p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 flex items-center gap-2.5'>
                <Lock size={16} className='shrink-0' />
                <span>You are viewing your official uploaded documents in <strong>Read-Only Mode</strong>. To add or update certificates, please submit them to Clinic Administration.</span>
              </div>
            )}

            {/* Uploaded Documents List */}
            <div className='space-y-3'>
              <h4 className='font-bold text-slate-300 uppercase tracking-wider text-[11px]'>
                Uploaded Certificates & Documents ({formData.documents?.length || 0})
              </h4>

              {(!formData.documents || formData.documents.length === 0) ? (
                <div className='p-6 text-center bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-400 space-y-2'>
                  <FileText size={28} className='mx-auto text-slate-600' />
                  <p className='font-semibold'>No certificates or documents attached yet.</p>
                  {isEditable && <p className='text-[11px] text-slate-500'>Use the upload form above to attach degrees, resumes, or certificates.</p>}
                </div>
              ) : (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {formData.documents.map(doc => (
                    <div key={doc.id} className='p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3 group hover:border-slate-700 transition'>
                      <div className='flex items-center gap-3 min-w-0'>
                        <div className='w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold shrink-0'>
                          {doc.category === 'Resume' ? <FileText size={18} /> : <Award size={18} />}
                        </div>
                        <div className='min-w-0 flex-1'>
                          <p className='font-bold text-white truncate'>{doc.title}</p>
                          <p className='text-[10px] text-cyan-400 font-semibold uppercase tracking-wider'>{doc.category} • {doc.uploadedAt}</p>
                          <p className='text-[10px] text-slate-400 truncate'>{doc.fileName}</p>
                        </div>
                      </div>

                      <div className='flex items-center gap-1 shrink-0'>
                        <a
                          href={doc.fileUrl}
                          download={doc.fileName}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition'
                          title='View / Download'
                        >
                          <Download size={14} />
                        </a>

                        {isEditable && (
                          <button
                            type='button'
                            onClick={() => handleRemoveDoc(doc.id)}
                            className='p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition'
                            title='Delete Document'
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bank' && (
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs'>
            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Basic Monthly Salary (₹)</label>
              <input
                type='number'
                disabled={!isEditable}
                value={formData.basicSalary}
                onChange={e => setFormData({ ...formData, basicSalary: parseFloat(e.target.value) || 0 })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-bold text-cyan-400'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Joining Date</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.joiningDate}
                onChange={e => setFormData({ ...formData, joiningDate: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Bank Name</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.bankName || ''}
                onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>Account Number</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.accountNumber || ''}
                onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>

            <div>
              <label className='block font-bold text-slate-300 uppercase tracking-wider mb-1.5'>IFSC Code</label>
              <input
                type='text'
                disabled={!isEditable}
                value={formData.ifscCode || ''}
                onChange={e => setFormData({ ...formData, ifscCode: e.target.value })}
                className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-75 disabled:bg-slate-950 focus:outline-none focus:border-cyan-400 font-medium'
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {isEditable && (
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-4'>
            {onClose && (
              <button
                type='button'
                onClick={onClose}
                className='py-3 px-5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition'
              >
                Cancel
              </button>
            )}

            <button
              type='submit'
              disabled={isSaving}
              className='py-3 px-6 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center gap-2'
            >
              {isSaving ? 'Saving Changes...' : 'Save Employee Profile & Documents'}
              {!isSaving && <Check size={16} />}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
