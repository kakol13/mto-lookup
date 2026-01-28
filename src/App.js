import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  FileUp, 
  User, 
  Calendar, 
  Database,
  X,
  Loader2,
  Copy,
  CheckCircle2
} from 'lucide-react';

const XLSX_SCRIPT_URL = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';

export default function App() {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    // Check if script already exists to avoid duplicates
    if (window.XLSX) return;
    const script = document.createElement('script');
    script.src = XLSX_SCRIPT_URL;
    script.async = true;
    script.onload = () => console.log('XLSX Loaded');
    document.head.appendChild(script);
  }, []);

  const isAccountNumber = (val) => {
    const s = String(val || "").trim();
    // Validates format: 0000-0000-00000
    return /^\d{4}-\d{4}-\d{5}$/.test(s);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Safety check for library
    if (!window.XLSX) {
      alert("Excel library is still loading. Please try again in a second.");
      return;
    }

    setFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target.result;
        const workbook = window.XLSX.read(dataBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Dynamic Column Mapping
        let headerRowIndex = -1;
        let baseColMap = { name: 1, date: 4, amount: 5, acct: 11, bps: 3, overdue: 7, sponsorName: 14 };

        // Search first 20 rows for the header
        for (let i = 0; i < Math.min(jsonRows.length, 20); i++) {
          const row = jsonRows[i];
          if (!Array.isArray(row)) continue;
          const nameIdx = row.findIndex(c => String(c || "").toLowerCase().includes("last, first name"));
          if (nameIdx !== -1) {
            headerRowIndex = i;
            baseColMap.name = nameIdx;
            const findCol = (term) => row.findIndex(c => String(c || "").toLowerCase().trim() === term.toLowerCase());
            const findColContains = (term) => row.findIndex(c => String(c || "").toLowerCase().includes(term.toLowerCase()));
            
            const acctIdx = findCol("acct. no.");
            if (acctIdx !== -1) baseColMap.acct = acctIdx;
            
            const dateIdx = findColContains("due date");
            if (dateIdx !== -1) baseColMap.date = dateIdx;
            
            const amtIdx = findColContains("due amount");
            if (amtIdx !== -1) baseColMap.amount = amtIdx;
            
            const bpsIdx = findCol("bps");
            if (bpsIdx !== -1) baseColMap.bps = bpsIdx;
            
            const overdueIdx = findColContains("amount overdue");
            if (overdueIdx !== -1) baseColMap.overdue = overdueIdx;
            
            const sponsorNameIdx = findCol("sponsor name");
            if (sponsorNameIdx !== -1) baseColMap.sponsorName = sponsorNameIdx;
            break;
          }
        }

        const dataRows = jsonRows.slice(headerRowIndex + 1);
        const formattedData = dataRows
          .filter(row => row[baseColMap.name] && String(row[baseColMap.name]).trim() !== "")
          .map((row, index) => {
            let acct = String(row[baseColMap.acct] || "").trim();
            if (!isAccountNumber(acct)) {
              const found = row.find(cell => isAccountNumber(cell));
              if (found) acct = String(found).trim();
            }
            return {
              id: index,
              memberName: String(row[baseColMap.name] || "").trim(),
              accountNumber: acct,
              dueDate: row[baseColMap.date] ? String(row[baseColMap.date]) : "N/A",
              dueAmount: parseFloat(row[baseColMap.amount]) || 0,
              bps: row[baseColMap.bps] || 0,
              overdue: row[baseColMap.overdue] || 0,
              upline: String(row[baseColMap.sponsorName] || "N/A").trim()
            };
          });
        setData(formattedData);
      } catch (err) {
        console.error("Processing Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCopy = (text, id) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const lowerTerm = searchTerm.toLowerCase().trim();
    return data
      .filter(i => i.memberName.toLowerCase().includes(lowerTerm))
      .slice(0, 50);
  }, [data, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-10 font-sans">
      <div className="bg-blue-600 h-48 w-full absolute top-0 left-0 rounded-b-[40px] shadow-lg" />
      
      <div className="relative z-10 max-w-md mx-auto px-4 pt-10 space-y-6">
        <header className="text-center text-white pb-2">
          <h1 className="text-3xl font-black tracking-tight uppercase">MTO Lookup</h1>
          <p className="text-blue-100 text-xs font-bold tracking-[0.2em] opacity-80 uppercase">Member Database</p>
        </header>

        <div className="bg-white rounded-[32px] shadow-xl p-6 space-y-6 border border-white/20">
          {!data.length ? (
            <div className="relative">
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileUpload} 
                disabled={isLoading} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              />
              <div className="border-2 border-dashed rounded-2xl p-10 text-center space-y-4 bg-blue-50/30 border-blue-200">
                {isLoading ? (
                  <Loader2 className="animate-spin text-blue-600 w-10 h-10 mx-auto" />
                ) : (
                  <FileUp className="text-blue-600 w-10 h-10 mx-auto" />
                )}
                <p className="font-extrabold text-slate-800">
                  {isLoading ? "Processing..." : "Upload Masterlist"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-100/50 rounded-2xl p-4">
              <div className="flex items-center space-x-3 overflow-hidden">
                <Database className="text-blue-600 w-5 h-5 shrink-0" />
                <p className="text-sm font-bold truncate text-slate-800">{fileName}</p>
              </div>
              <button 
                onClick={() => {setData([]); setSearchTerm('');}} 
                className="p-2 text-slate-400 hover:text-red-500 bg-white rounded-full shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {data.length > 0 && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Type member name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all shadow-inner"
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {searchTerm.length >= 2 && filteredResults.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                  <User className="text-blue-600 w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-black text-slate-800 uppercase truncate">{item.memberName}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">
                    Upline: <span className="text-blue-600">{item.upline}</span>
                  </p>
                </div>
              </div>

              <div 
                onClick={() => handleCopy(item.accountNumber, item.id)} 
                className="bg-slate-900 rounded-2xl p-4 mb-4 cursor-pointer active:scale-95 transition-all relative overflow-hidden group"
              >
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Account Number</span>
                    <p className="text-xl font-mono font-bold text-white tracking-wider">
                      {item.accountNumber || "NOT FOUND"}
                    </p>
                  </div>
                  <div className={`p-2 rounded-xl transition-colors ${copiedId === item.id ? 'bg-green-500' : 'bg-slate-800 text-slate-400'}`}>
                    {copiedId === item.id ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5" />}
                  </div>
                </div>
                {copiedId === item.id && (
                  <div className="absolute inset-0 bg-green-500/10 animate-pulse" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Due Date</span>
                  <div className="flex items-center text-sm font-bold text-slate-700 mt-1">
                    <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                    {item.dueDate}
                  </div>
                </div>
                <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100">
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest text-right block">Amount Due</span>
                  <div className="flex items-center justify-end text-lg font-black text-blue-700 mt-1">
                    ₱{item.dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {searchTerm.length >= 2 && filteredResults.length === 0 && (
            <div className="text-center p-10 bg-white/50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No results found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}