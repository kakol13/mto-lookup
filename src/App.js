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
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  Users
} from 'lucide-react';

const XLSX_SCRIPT_URL = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';

export default function App() {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (window.XLSX) return;
    const script = document.createElement('script');
    script.src = XLSX_SCRIPT_URL;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const isAccountNumber = (val) => {
    const s = String(val || "").trim();
    return /^\d{4}-\d{4}-\d{5}$/.test(s);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const formatRawDate = (val) => {
    const s = String(val || "").trim();
    if (s.length === 8 && /^\d+$/.test(s)) {
      return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    }
    return s || "N/A";
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!window.XLSX) {
      alert("System still initializing. Please wait 2 seconds and try again.");
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
        
        let headerRowIndex = -1;
        let baseColMap = { name: 1, date: 4, amount: 5, acct: 11, bps: 3, overdue: 7 };
        let sponsorColIndices = []; 

        for (let i = 0; i < Math.min(jsonRows.length, 40); i++) {
          const row = jsonRows[i];
          if (!Array.isArray(row)) continue;
          
          const lowerRow = row.map(c => String(c || "").toLowerCase().trim());
          const nameIdx = lowerRow.findIndex(c => c.includes("last, first name") || c === "member name" || (c.includes("name") && !c.includes("sponsor")));
          
          if (nameIdx !== -1) {
            headerRowIndex = i;
            baseColMap.name = nameIdx;
            
            const findCol = (term) => lowerRow.findIndex(c => c === term.toLowerCase());
            const findColContains = (term) => lowerRow.findIndex(c => c.includes(term.toLowerCase()));
            
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
            
            lowerRow.forEach((cell, idx) => {
              if (cell.includes("sponsor") || cell.includes("upline")) {
                sponsorColIndices.push(idx);
              }
            });
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

            let sponsorVal = "N/A";
            for (let colIdx of sponsorColIndices) {
              const val = String(row[colIdx] || "").trim();
              if (val && isNaN(Number(val)) && /[a-zA-Z]/.test(val)) {
                sponsorVal = val;
                break;
              }
            }

            return {
              id: index,
              memberName: String(row[baseColMap.name] || "").trim(),
              accountNumber: acct,
              dueDate: formatRawDate(row[baseColMap.date]),
              dueAmount: parseFloat(row[baseColMap.amount]) || 0,
              bps: parseFloat(row[baseColMap.bps]) || 0,
              overdue: parseFloat(row[baseColMap.overdue]) || 0,
              upline: sponsorVal
            };
          });
        setData(formattedData);
      } catch (err) {
        console.error("Error processing file:", err);
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
    return data.filter(i => i.memberName.toLowerCase().includes(lowerTerm)).slice(0, 50);
  }, [data, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-10 font-sans">
      <div className="bg-blue-600 h-48 w-full absolute top-0 left-0 rounded-b-[40px] shadow-lg" />
      <div className="relative z-10 max-w-md mx-auto px-4 pt-10 space-y-6">
        <header className="text-center text-white pb-2">
          <h1 className="text-3xl font-black tracking-tight uppercase leading-none">MTO Lookup</h1>
          <p className="text-blue-100 text-[10px] font-bold tracking-[0.3em] opacity-80 uppercase mt-2">Member Database</p>
        </header>

        <div className="bg-white rounded-[32px] shadow-xl p-6 space-y-6">
          {!data.length ? (
            <div className="relative">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={isLoading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="border-2 border-dashed rounded-2xl p-10 text-center space-y-4 bg-blue-50/30 border-blue-200">
                {isLoading ? <Loader2 className="animate-spin text-blue-600 w-10 h-10 mx-auto" /> : <FileUp className="text-blue-600 w-10 h-10 mx-auto" />}
                <p className="font-extrabold text-slate-800">{isLoading ? "Processing..." : "Upload Masterlist"}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-100/50 rounded-2xl p-4">
              <div className="flex items-center space-x-3 overflow-hidden">
                <Database className="text-blue-600 w-5 h-5 shrink-0" />
                <p className="text-sm font-bold truncate text-slate-800">{fileName}</p>
              </div>
              <button onClick={() => {setData([]); setSearchTerm('');}} className="p-2 text-slate-400 hover:text-red-500 bg-white rounded-full shadow-sm transition-colors"><X className="w-5 h-5" /></button>
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
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0 mt-1">
                  <User className="text-blue-600 w-5 h-5" />
                </div>
                <div className="overflow-hidden flex-1">
                  <h3 className="font-black text-slate-800 uppercase truncate leading-tight mb-1">{item.memberName}</h3>
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3 text-blue-400 shrink-0" />
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate">
                      Upline: <span className="text-blue-600">{item.upline}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div onClick={() => handleCopy(item.accountNumber, item.id)} className="bg-slate-900 rounded-2xl p-4 mb-4 cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden group">
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Account Number</span>
                    <p className="text-xl font-mono font-bold text-white tracking-wider">{item.accountNumber || "NOT FOUND"}</p>
                  </div>
                  <div className={`p-2 rounded-xl transition-colors ${copiedId === item.id ? 'bg-green-500' : 'bg-slate-800 text-slate-400'}`}>
                    {copiedId === item.id ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Due Date</span>
                  <div className="flex items-center text-sm font-bold text-slate-700 mt-1"><Calendar className="w-4 h-4 mr-2 text-blue-500" />{item.dueDate}</div>
                </div>
                <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100">
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest text-right block">Amount Due</span>
                  <div className="flex items-center justify-end text-lg font-black text-blue-700 mt-1">₱{formatCurrency(item.dueAmount)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50/50 rounded-2xl p-3 border border-green-100">
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Brochure Sales</span>
                  <div className="flex items-center text-sm font-bold text-green-700 mt-1"><TrendingUp className="w-4 h-4 mr-2" />₱{formatCurrency(item.bps)}</div>
                </div>
                <div className="bg-red-50/50 rounded-2xl p-3 border border-red-100">
                  <span className="text-[9px] font-black text-red-400 uppercase tracking-widest text-right block">Overdue</span>
                  <div className="flex items-center justify-end text-sm font-bold text-red-700 mt-1"><ShieldAlert className="w-4 h-4 mr-2" />₱{formatCurrency(item.overdue)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}