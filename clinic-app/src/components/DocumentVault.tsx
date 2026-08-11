import { useState, useEffect, useRef } from 'react';
import {
  Upload, Download, Trash2, FileText, File, Image,
  FolderOpen, AlertCircle, CheckCircle, RefreshCw, Eye, X, Users
} from 'lucide-react';
import { db, storage } from '../firebase';
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy
} from 'firebase/firestore';
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from 'firebase/storage';
import { getStaffByInput, OFFICIAL_STAFF_REGISTRY } from '../constants/staffRegistry';

interface DocumentRecord {
  id: string;
  empId: string;
  empName: string;
  empEmail: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  fileType: string;
  fileSize: number;
  category: 'Certificate' | 'Resume' | 'ID Proof' | 'Other';
  uploadedAt: number;
  uploadedBy: string;
}

interface Props {
  isAdmin: boolean;
  currentEmpEmail: string;
}

const CATEGORIES = ['Certificate', 'Resume', 'ID Proof', 'Other'] as const;
const MAX_FILE_SIZE_MB = 10;

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return <Image size={16} className="text-purple-400" />;
  if (fileType === 'application/pdf') return <FileText size={16} className="text-rose-400" />;
  return <File size={16} className="text-cyan-400" />;
}

export default function DocumentVault({ isAdmin, currentEmpEmail }: Props) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Certificate');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canonicalSelf = getStaffByInput(currentEmpEmail);

  const showStatus = (msg: string, type: 'success' | 'error') => {
    setStatusMsg(msg);
    setStatusType(type);
    setTimeout(() => { setStatusMsg(''); setStatusType(''); }, 4000);
  };

  const fetchDocs = async () => {
    setLoading(true);
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, 'EmployeeDocuments'), orderBy('uploadedAt', 'desc'));
      } else {
        if (!canonicalSelf) { setLoading(false); return; }
        q = query(
          collection(db, 'EmployeeDocuments'),
          where('empId', '==', canonicalSelf.empId),
          orderBy('uploadedAt', 'desc')
        );
      }
      const snap = await getDocs(q);
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentRecord)));
    } catch (e: any) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [currentEmpEmail]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const oversized = files.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      showStatus('Files must be under ' + MAX_FILE_SIZE_MB + 'MB. Remove: ' + oversized.map(f => f.name).join(', '), 'error');
      return;
    }
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) return;
    if (!canonicalSelf) {
      showStatus('Could not identify your employee profile. Contact admin.', 'error');
      return;
    }
    setUploading(true);
    let successCount = 0;
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const storagePath = 'employee-docs/' + canonicalSelf.empId + '/' + Date.now() + '_' + file.name;
      const storageRef = ref(storage, storagePath);
      try {
        await new Promise<void>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, file);
          uploadTask.on('state_changed',
            (snap) => {
              setUploadProgress(Math.round(
                ((i / selectedFiles.length) + (snap.bytesTransferred / snap.totalBytes) / selectedFiles.length) * 100
              ));
            },
            reject,
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              await addDoc(collection(db, 'EmployeeDocuments'), {
                empId: canonicalSelf.empId,
                empName: canonicalSelf.name,
                empEmail: canonicalSelf.email,
                fileName: file.name,
                fileUrl: url,
                storagePath,
                fileType: file.type,
                fileSize: file.size,
                category,
                uploadedAt: Date.now(),
                uploadedBy: currentEmpEmail,
              });
              successCount++;
              resolve();
            }
          );
        });
      } catch (e: any) {
        showStatus('Upload failed for ' + file.name + ': ' + e.message, 'error');
      }
    }
    setUploading(false);
    setUploadProgress(0);
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (successCount > 0) {
      showStatus('✓ ' + successCount + ' file(s) uploaded successfully!', 'success');
      fetchDocs();
    }
  };

  const handleDelete = async (docRecord: DocumentRecord) => {
    if (!confirm('Delete "' + docRecord.fileName + '"? This cannot be undone.')) return;
    try {
      const storageRef = ref(storage, docRecord.storagePath);
      await deleteObject(storageRef).catch(() => {});
      await deleteDoc(doc(db, 'EmployeeDocuments', docRecord.id));
      setDocs(prev => prev.filter(d => d.id !== docRecord.id));
      showStatus('Document deleted.', 'success');
    } catch (e: any) {
      showStatus('Delete failed: ' + e.message, 'error');
    }
  };

  const handleDownload = (docRecord: DocumentRecord) => {
    const a = document.createElement('a');
    a.href = docRecord.fileUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const empOptions = isAdmin
    ? [{ value: 'all', label: 'All Employees' },
       ...OFFICIAL_STAFF_REGISTRY.filter(s => !s.isAdmin).map(s => ({ value: s.empId, label: s.name }))]
    : [];

  const filteredDocs = isAdmin && selectedEmp !== 'all'
    ? docs.filter(d => d.empId === selectedEmp)
    : docs;

  const categoryColors: Record<string, string> = {
    Certificate: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Resume: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    'ID Proof': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Other: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <FolderOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {isAdmin ? 'Employee Document Vault' : 'My Documents & Certificates'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? 'View and download documents uploaded by all employees'
                  : 'Upload and manage your certificates, resume, and ID documents'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchDocs}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {statusMsg && (
          <div className={'mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ' + (
            statusType === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          )}>
            {statusType === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {statusMsg}
          </div>
        )}

        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload New Document</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Files (PDF, images, Word — max {MAX_FILE_SIZE_MB}MB each)</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
                onChange={handleFileSelect}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-500/20 file:text-indigo-300 file:font-semibold file:text-xs hover:file:bg-indigo-500/30 file:cursor-pointer bg-slate-900 border border-slate-700 rounded-xl p-2 cursor-pointer"
              />
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300 border border-slate-700">
                  {getFileIcon(f.type)}
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <span className="text-slate-500">{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-cyan-400">
                <RefreshCw size={14} className="animate-spin" />
                Uploading... {uploadProgress}%
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-1.5 rounded-full transition-all" style={{ width: uploadProgress + '%' }} />
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFiles.length || uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={15} />
            {uploading ? 'Uploading...' : 'Upload ' + (selectedFiles.length > 0 ? '(' + selectedFiles.length + ' file' + (selectedFiles.length > 1 ? 's' : '') + ')' : 'Documents')}
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-indigo-400" />
            <span className="text-sm font-bold text-white">
              {filteredDocs.length} Document{filteredDocs.length !== 1 ? 's' : ''}
              {isAdmin && selectedEmp !== 'all' && ' — ' + (OFFICIAL_STAFF_REGISTRY.find(s => s.empId === selectedEmp)?.name || '')}
            </span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-400" />
              <select
                value={selectedEmp}
                onChange={e => setSelectedEmp(e.target.value)}
                className="p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              >
                {empOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-indigo-400" />
            Loading documents...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
            <FolderOpen size={36} className="text-slate-700" />
            <p>No documents uploaded yet.</p>
            <p className="text-xs text-slate-600">Upload certificates, ID proof, or resume above.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredDocs.map(docRecord => (
              <div key={docRecord.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-slate-800/30 transition">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                    {getFileIcon(docRecord.fileType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{docRecord.fileName}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {isAdmin && (
                        <span className="text-xs text-indigo-300 font-medium">{docRecord.empName}</span>
                      )}
                      <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full border ' + (categoryColors[docRecord.category] || categoryColors['Other'])}>
                        {docRecord.category}
                      </span>
                      <span className="text-[10px] text-slate-500">{formatBytes(docRecord.fileSize)}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(docRecord.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(docRecord.fileType.startsWith('image/') || docRecord.fileType === 'application/pdf') && (
                    <button
                      onClick={() => { setPreviewUrl(docRecord.fileUrl); setPreviewName(docRecord.fileName); }}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
                      title="Preview"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(docRecord)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-xs font-semibold transition"
                  >
                    <Download size={13} />
                    Download
                  </button>
                  {(isAdmin || docRecord.empId === canonicalSelf?.empId) && (
                    <button
                      onClick={() => handleDelete(docRecord)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                      title="Delete"
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

      {previewUrl && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => { setPreviewUrl(''); setPreviewName(''); }}>
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <p className="text-sm font-semibold text-white truncate">{previewName}</p>
              <div className="flex items-center gap-2">
                <a href={previewUrl} download={previewName} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-500/20 hover:bg-indigo-500/30 transition">
                  <Download size={13} /> Download
                </a>
                <button onClick={() => { setPreviewUrl(''); setPreviewName(''); }} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {previewName.match(/\.(jpg|jpeg|png|webp|gif)$/i)
                ? <img src={previewUrl} alt={previewName} className="w-full object-contain" />
                : <iframe src={previewUrl} className="w-full h-full min-h-[60vh]" title={previewName} />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

