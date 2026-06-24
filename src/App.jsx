import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Skull, Scroll, Feather, ArrowRightLeft, Download, Upload, X, Search, Globe, ChevronRight, 
  Sparkles, Flame, Clipboard, Languages, Zap, BookOpen, ChevronLeft, Plus, Volume2, Split, 
  AlignJustify, Database, Network, Trash2, Library, AlertCircle, Eye, EyeOff, 
  VolumeX, Save, RotateCcw, CheckCircle, XCircle, Quote, Keyboard, Activity, FileSpreadsheet, 
  SkipForward, Trophy, Award, AlertTriangle, BrainCircuit, Ghost, Moon, Scale, RefreshCw, Filter, Info
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, initializeFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc, increment, getDocs, addDoc } from 'firebase/firestore';

/**
 * THE OCCULT SINOLOGIST & PAIN ENGINE (UNIFIED SCHEMA)
 * Master Project Specification v8.0 (Unthrottled Neural Matrix & Operations Codex)
 * Analyst: Curtis Orion
 * Theme: "Pain & Sublimation" (Rose/Zinc/Stone)
 */

// --- FIREBASE INITIALISATION ---
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try {
    db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
        useFetchStreams: false
    });
} catch (err) {
    db = getFirestore(app);
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const configuredCloudArchiveId = firebaseConfig.cloudArchiveId || '';

// --- CONSTANTS ---
const VOCAB_SEPARATOR = "### VOCABULARY ###";
const REGISTER_OPTIONS = ["Formal", "Neutral", "Colloquial", "Literary"];
const normalizeRegister = (value) => REGISTER_OPTIONS.find(option => option.toLowerCase() === String(value || '').trim().toLowerCase()) || '';
const getCardRegister = (card) => normalizeRegister(card?.register) || 'Neutral';
const registerOptionList = () => REGISTER_OPTIONS.map(option => ({ label: option, value: option }));

// --- GALE-CHURCH ALIGNMENT ALGORITHM ---
const calculateCost = (len1, len2, meanRatio, variance, matchProb) => {
    if (len1 === 0 && len2 === 0) return 0;
    if (len1 === 0) return -Math.log(matchProb) + 100;
    if (len2 === 0) return -Math.log(matchProb) + 100;
    const mean = len1 * meanRatio;
    const sd = Math.sqrt(len1 * variance);
    const z = (len2 - mean) / sd;
    let probZ = Math.exp(-(z * z) / 2) / 2.5;
    if (probZ < 1e-10) probZ = 1e-10;
    return -Math.log(matchProb) - Math.log(probZ);
};

const galeChurchAlign = (sourceLines, targetLines) => {
    const PRIOR_PROBS = { "1-1": 0.89, "1-0": 0.0099, "0-1": 0.0099, "2-1": 0.089, "1-2": 0.089, "2-2": 0.011 };
    const MATCH_TYPES = [[1, 1], [1, 0], [0, 1], [2, 1], [1, 2], [2, 2]];
    const n = sourceLines.length; const m = targetLines.length;
    let totalLen1 = 0; let totalLen2 = 0;
    sourceLines.forEach(l => totalLen1 += l.length); targetLines.forEach(l => totalLen2 += l.length);
    if (totalLen1 === 0) totalLen1 = 1;
    const c = totalLen2 / totalLen1; const s2 = 6.8;
    const dist = Array(n + 1).fill(null).map(() => Array(m + 1).fill(Infinity));
    const path = Array(n + 1).fill(null).map(() => Array(m + 1).fill([0, 0]));
    dist[0][0] = 0;
    
    for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= m; j++) {
            if (i === 0 && j === 0) continue;
            for (let k = 0; k < MATCH_TYPES.length; k++) {
                const [di, dj] = MATCH_TYPES[k];
                if (i - di >= 0 && j - dj >= 0) {
                    let l1 = 0; let l2 = 0;
                    for (let x = 0; x < di; x++) l1 += sourceLines[i - di + x].length;
                    for (let x = 0; x < dj; x++) l2 += targetLines[j - dj + x].length;
                    const typeKey = `${di}-${dj}`;
                    const cost = calculateCost(l1, l2, c, s2, PRIOR_PROBS[typeKey]);
                    if (dist[i - di][j - dj] + cost < dist[i][j]) { 
                        dist[i][j] = dist[i - di][j - dj] + cost; 
                        path[i][j] = [di, dj]; 
                    }
                }
            }
        }
    }
    
    const alignment = [];
    let i = n; let j = m;
    while (i > 0 || j > 0) {
        const [di, dj] = path[i][j];
        if (di === 0 && dj === 0) break;
        let srcSeg = ""; let trgSeg = "";
        for (let x = 0; x < di; x++) srcSeg += sourceLines[i - di + x] + " ";
        for (let x = 0; x < dj; x++) trgSeg += targetLines[j - dj + x] + " ";
        alignment.unshift({ sc: srcSeg.trim(), en: trgSeg.trim() });
        i -= di; j -= dj;
    }
    return alignment;
};

// --- BASE NLP ENGINE ---
const FALLBACK_SC_TC_MAP = {
    '国': '國', '会': '會', '这': '這', '说': '說', '话': '話', '为': '為', '获': '獲', '奖': '獎',
    '贝': '貝', '尔': '爾', '学': '學', '见': '見', '现': '現', '让': '讓', '坚': '堅', '义': '義',
    '个': '個', '们': '們', '来': '來', '书': '書', '门': '門', '车': '車', '马': '馬', '鸟': '鳥',
    '龙': '龍', '页': '頁', '鱼': '魚', '讲': '講', '对': '對', '当': '當', '时': '時', '后': '後',
    '发': '發', '里': '裡', '区': '區', '无': '無', '法': '法', '体': '體', '系': '係', '统': '統'
};

const FALLBACK_TC_SC_MAP = Object.entries(FALLBACK_SC_TC_MAP).reduce((acc, [sc, tc]) => {
    acc[tc] = sc;
    return acc;
}, {});

const MOCK_DICT = {
    '我': { pinyin: 'wǒ', def: 'I; me; my' },
    '是': { pinyin: 'shì', def: 'is; are; am; yes' },
    '一个': { pinyin: 'yī gè', def: 'one; a; an' },
    '讲故事': { pinyin: 'jiǎng gù shì', def: 'to tell a story' },
    '的人': { pinyin: 'de rén', def: 'person who...' }
};

// --- CSV PARSER ---
const parseCSV = (text) => {
    const rows = []; let currentRow = []; let currentCell = ''; let insideQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i]; const nextChar = text[i + 1];
        if (char === '"') { if (insideQuote && nextChar === '"') { currentCell += '"'; i++; } else insideQuote = !insideQuote; } 
        else if ((char === ',' || char === '\t') && !insideQuote) { currentRow.push(currentCell.trim()); currentCell = ''; } 
        else if ((char === '\n' || char === '\r') && !insideQuote) {
            if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); currentRow = []; currentCell = ''; }
            if (char === '\r' && nextChar === '\n') i++;
        } else { currentCell += char; }
    }
    if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
    return rows;
};

// --- TSV EXPORTER (Strict 11-Column Schema) ---
const exportToTSV = (dataSet, filename) => {
    const headers = [
        "Hanzi", "Pinyin", "Meaning", "Category", "Notes", 
        "Example (CN)", "Example (EN)", "Distractors", 
        "Nuance Tip", "Register", "Monolingual Def (CN)"
    ];
    
    const rows = dataSet.map(item => {
        const cleanField = (str) => {
            if (!str) return "";
            return String(str).replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
        };

        return [
            cleanField(item.hanzi || item.term || ""),
            cleanField(item.pinyin),
            cleanField(item.meaning || item.def),
            cleanField(item.category),
            cleanField(item.notes),
            cleanField(item.example),
            cleanField(item.example_meaning),
            cleanField(item.distractors),
            cleanField(item.nuance_tip),
            cleanField(item.register),
            cleanField(item.definition_cn)
        ].join("\t");
    });

    const tsvContent = [headers.join("\t"), ...rows].join("\n");
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// --- UTILS ---
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- DEMO DATA ---
const DEMO_SEGMENTS = [
  { id: '1', sc: "我是一个讲故事的人。", tc: "我是一個講故事的人。", en: "I am a storyteller.", pinyin: "Wǒ shì yī gè jiǎng gù shì de rén.", category: 'Lit' },
  { id: '2', sc: "因为讲故事，我获得了诺贝尔文学奖。", tc: "因為講故事，我獲得了諾貝爾文學獎。", en: "Because of storytelling, I won the Nobel Prize in Literature.", pinyin: "Yīn wèi jiǎng gù shì, wǒ huò dé le nuò bèi ěr wén xué jiǎng.", category: 'Lit' }
];

const DEMO_MANUSCRIPT = { id: 'demo-moyan', title: 'Mo Yan: The Storyteller (Offline Demo)', date: new Date().toISOString().split('T')[0], category: 'Lit', content: DEMO_SEGMENTS };
const LOCAL_STORE_KEY = 'occult-sinologist-local-v2';
const CLOUD_CONFIG_STORE_KEY = 'occult-sinologist-firebase-config';
const CLOUD_BATCH_SIZE = 20;
const CLOUD_COMMIT_TIMEOUT_MS = 90000;

const createStats = () => ({
    streak: 0,
    ease: 2.5,
    interval: 0,
    dueDate: new Date().toISOString().split('T')[0],
    lastReviewed: null,
    tags: [],
    mastery_recognition: 0,
    mastery_production: 0,
    mastery_cloze: 0,
    mastery_nuance: 0,
    mastery_mono: 0,
    clozeTarget: '',
    views_forward: 0, correct_forward: 0, incorrect_forward: 0,
    views_reverse: 0, correct_reverse: 0, incorrect_reverse: 0,
    views_cloze: 0, correct_cloze: 0, incorrect_cloze: 0,
    isMastered: false
});

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayKey = () => new Date().toISOString().split('T')[0];
const addDaysKey = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};
const knownCardFields = () => ({
    streak: 50,
    interval: 365,
    dueDate: addDaysKey(3650),
    lastReviewed: todayKey(),
    isMastered: true,
    mastery_recognition: 100,
    mastery_production: 100,
    mastery_cloze: 100,
    mastery_nuance: 100,
    mastery_mono: 100
});
const reactivateCardFields = () => ({
    streak: 0,
    interval: 0,
    dueDate: todayKey(),
    isMastered: false
});
const REVIEW_COUNTER_FIELDS = new Set([
    'views_forward',
    'views_reverse',
    'views_cloze',
    'correct_forward',
    'correct_reverse',
    'correct_cloze',
    'incorrect_forward',
    'incorrect_reverse',
    'incorrect_cloze'
]);

const isHeaderLikeCard = (card) => {
    const hanzi = String(card?.hanzi || card?.term || '').trim().toLowerCase();
    const pinyin = String(card?.pinyin || '').trim().toLowerCase();
    const meaning = String(card?.meaning || '').trim().toLowerCase();
    return hanzi === 'hanzi' && (pinyin === 'pinyin' || meaning === 'meaning');
};

const isReviewableCard = (card) => Boolean(card?.hanzi?.trim() && card?.meaning?.trim() && !isHeaderLikeCard(card));
const totalReviewsForCard = (card) => (card?.views_forward || 0) + (card?.views_reverse || 0) + (card?.views_cloze || 0);
const difficultyScore = (card) => {
    const misses = (card?.incorrect_forward || 0) + (card?.incorrect_reverse || 0) + (card?.incorrect_cloze || 0);
    const mastery = (card?.mastery_recognition || 0) + (card?.mastery_production || 0) + (card?.mastery_cloze || 0) + (card?.mastery_nuance || 0) + (card?.mastery_mono || 0);
    const overdue = !card?.dueDate || card.dueDate <= todayKey() ? 4 : 0;
    return misses * 4 - (card?.streak || 0) + overdue - Math.round(mastery / 50);
};

const normalizeVocabRow = (cols, fallbackCategory = 'Imported') => {
    if (!cols || cols.length < 1 || !cols[0]?.trim()) return null;
    const term = cols[0].trim();
    if (isHeaderLikeCard({ hanzi: term, pinyin: cols[1], meaning: cols[2] })) return null;
    return {
        id: makeId('card'),
        hanzi: term,
        term,
        pinyin: cols[1]?.trim() || "",
        meaning: cols[2]?.trim() || "",
        category: cols[3]?.trim() || fallbackCategory,
        notes: cols[4]?.trim() || "",
        example: cols[5]?.trim() || "",
        example_meaning: cols[6]?.trim() || "",
        distractors: cols[7]?.trim() || "",
        nuance_tip: cols[8]?.trim() || "",
        register: cols[9]?.trim() || "",
        definition_cn: cols[10]?.trim() || "",
        ...createStats()
    };
};

const readLocalStore = () => {
    try {
        const raw = localStorage.getItem(LOCAL_STORE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        console.warn("Local archive unreadable:", err);
        return null;
    }
};

const CLOUD_DOC_SOFT_LIMIT = 650000;
const withCloudTimeout = (promise, label = 'Cloud upload', timeoutMs = CLOUD_COMMIT_TIMEOUT_MS) => Promise.race([
    promise,
    new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out. Check the internet connection and Firestore rules, then try again.`)), timeoutMs);
    })
]);

const splitManuscriptForCloud = (manuscript) => {
    const content = Array.isArray(manuscript.content) ? manuscript.content : [];
    const withoutContent = { ...manuscript, content: [] };
    const oneDocSize = JSON.stringify(manuscript).length;
    if (oneDocSize <= CLOUD_DOC_SOFT_LIMIT) {
        return { meta: { ...manuscript, chunked: false, chunkCount: 0, contentLength: content.length }, chunks: [] };
    }
    const chunks = [];
    let current = [];
    let currentSize = 2;
    content.forEach((segment) => {
        const segmentSize = JSON.stringify(segment).length + 1;
        if (current.length && currentSize + segmentSize > CLOUD_DOC_SOFT_LIMIT) {
            chunks.push(current);
            current = [];
            currentSize = 2;
        }
        current.push(segment);
        currentSize += segmentSize;
    });
    if (current.length) chunks.push(current);
    return {
        meta: { ...withoutContent, chunked: true, chunkCount: chunks.length, contentLength: content.length },
        chunks: chunks.map((chunk, index) => ({
            id: `${manuscript.id}__chunk__${index}`,
            parentId: manuscript.id,
            chunkIndex: index,
            content: chunk
        }))
    };
};

const assembleCloudManuscripts = (docs) => {
    const manuscripts = [];
    const chunksByParent = {};
    docs.forEach(snapshotDoc => {
        const data = snapshotDoc.data();
        if (data.parentId && typeof data.chunkIndex === 'number') {
            chunksByParent[data.parentId] = [...(chunksByParent[data.parentId] || []), data];
        } else {
            manuscripts.push(data);
        }
    });
    return manuscripts.map(manuscript => {
        if (!manuscript.chunked) return manuscript;
        const chunks = (chunksByParent[manuscript.id] || []).sort((a, b) => a.chunkIndex - b.chunkIndex);
        return { ...manuscript, content: chunks.flatMap(chunk => chunk.content || []) };
    });
};

const openLocalDb = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB unavailable'));
        return;
    }
    const request = indexedDB.open('pain-engine-local-db', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('archives');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
});

const readLocalStoreAsync = async () => {
    try {
        const db = await openLocalDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction('archives', 'readonly');
            const request = tx.objectStore('archives').get(LOCAL_STORE_KEY);
            request.onsuccess = () => resolve(request.result || readLocalStore());
            request.onerror = () => reject(request.error || new Error('IndexedDB read failed'));
        });
    } catch (err) {
        return readLocalStore();
    }
};

const writeLocalStoreAsync = async (payload) => {
    try {
        const db = await openLocalDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('archives', 'readwrite');
            tx.objectStore('archives').put(payload, LOCAL_STORE_KEY);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
        });
        try {
            localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify({
                ...payload,
                library: (payload.library || []).slice(0, 3),
                cards: (payload.cards || []).slice(0, 50),
                archivedInIndexedDB: true
            }));
        } catch {}
        return true;
    } catch (err) {
        try {
            localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(payload));
            return true;
        } catch (fallbackErr) {
            console.error("Local archive write failed:", fallbackErr);
            return false;
        }
    }
};

// --- CHROMATIC GRADIENT ENGINE ---
const getStreakStyle = (streak = 0) => {
    const abs = Math.abs(streak);
    const intensity = Math.min(abs / 50, 1);
    const percent = (intensity * 100).toFixed(0);

    if (streak >= 50) return { style: { animation: 'divine-glow 2s infinite' }, className: 'font-bold text-emerald-400' };
    if (streak <= -50) return { style: { animation: 'bloody-glow 2s infinite' }, className: 'font-bold text-red-500' };

    if (streak > 0) {
        return {
            style: {
                color: `color-mix(in srgb, #10b981 ${percent}%, #a8a29e)`, 
                textShadow: `0 0 ${intensity * 12}px rgba(16,185,129,${intensity * 0.8})`
            },
            className: 'font-bold transition-colors duration-500'
        };
    } else if (streak < 0) {
        return {
            style: {
                color: `color-mix(in srgb, #ef4444 ${percent}%, #a8a29e)`,
                textShadow: `0 0 ${intensity * 12}px rgba(239,68,68,${intensity * 0.8})`
            },
            className: 'font-bold transition-colors duration-500'
        };
    }
    
    return { style: { color: '#a8a29e' }, className: 'font-bold transition-colors duration-500' }; 
};

const getStreakWatermark = (streak = 0) => {
    if (streak >= 50) return { text: "THE RAPTURE", bgClass: "text-emerald-500" };
    if (streak >= 40) return { text: "THE RADIANCE", bgClass: "text-emerald-500/50" };
    if (streak >= 20) return { text: "THE VAPOUR", bgClass: "text-emerald-500/20" };
    
    if (streak <= -50) return { text: "NECROSIS", bgClass: "text-red-600" };
    if (streak <= -40) return { text: "THE ABYSS", bgClass: "text-red-600/50" };
    if (streak <= -20) return { text: "HELL IS REPETITION", bgClass: "text-red-600/20" };
    
    return { text: null, bgClass: "" };
}

const App = () => {
  // --- UNIFIED STATE ---
  const [user, setUser] = useState(null);
  const [currentAppView, setCurrentAppView] = useState('reader'); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localReady, setLocalReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(`${LOCAL_STORE_KEY}-onboarded`) !== 'true');

  // --- READER STATE (Hemisphere L) ---
  const [script, setScript] = useState('SC');
  const [mode, setMode] = useState('bilingual');
  const [syntaxMode, setSyntaxMode] = useState(false);
  const [selection, setSelection] = useState(null);
  const [readerPanelOpen, setReaderPanelOpen] = useState(false);
  const [userDict, setUserDict] = useState({});
  const [conversionCodex, setConversionCodex] = useState({});
  const [library, setLibrary] = useState([]);
  const [activeManuscriptId, setActiveManuscriptId] = useState(null);
  
  // Analytics & Core State
  const [activityData, setActivityData] = useState([]);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [statsFilter, setStatsFilter] = useState('1M'); // Default to 1 Month

  // Reader Modals
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showLexiconModal, setShowLexiconModal] = useState(false);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [harvestedWords, setHarvestedWords] = useState([]);
  const [ingestTab, setIngestTab] = useState('standard');
  const [pasteContent, setPasteContent] = useState('');
  const [manuscriptPreview, setManuscriptPreview] = useState(null);
  const [alignSource, setAlignSource] = useState('');
  const [alignTarget, setAlignTarget] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [selectedGlossaryTerms, setSelectedGlossaryTerms] = useState(new Set());
  const [lexiconSearch, setLexiconSearch] = useState('');
  const [lexiconCategory, setLexiconCategory] = useState('All');
  const [recentHarvests, setRecentHarvests] = useState([]);
  const [segmentationOverrides, setSegmentationOverrides] = useState({});
  const [segmentAnnotations, setSegmentAnnotations] = useState({});
  const [segmentationDraft, setSegmentationDraft] = useState('');
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [showSentenceStudy, setShowSentenceStudy] = useState(false);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [sentenceFlipped, setSentenceFlipped] = useState(false);

  // --- PAIN STATE (Hemisphere R) ---
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState(() => {
      try { return JSON.parse(localStorage.getItem(`${LOCAL_STORE_KEY}-voice`) || '{"voiceURI":"","rate":0.8}'); }
      catch { return { voiceURI: '', rate: 0.8 }; }
  });
  const [availableVoices, setAvailableVoices] = useState([]);
  const [painMode, setPainMode] = useState('recurring');
  const [reviewMode, setReviewMode] = useState('due');
  const [isReviewSession, setIsReviewSession] = useState(false);
  const [showCardBrowser, setShowCardBrowser] = useState(false);
  const [cardSearch, setCardSearch] = useState('');
  const [cardFilter, setCardFilter] = useState('due');
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [editingCard, setEditingCard] = useState(null);
  const [sessionReport, setSessionReport] = useState(null);
  const [showDataAudit, setShowDataAudit] = useState(false);
  const [showRelationGraph, setShowRelationGraph] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [cloudConfigDraft, setCloudConfigDraft] = useState(() => {
      try { return localStorage.getItem(CLOUD_CONFIG_STORE_KEY) || JSON.stringify(firebaseConfig || {}, null, 2); }
      catch { return JSON.stringify(firebaseConfig || {}, null, 2); }
  });
  const [syncStatus, setSyncStatus] = useState('');
  const [cloudStateReady, setCloudStateReady] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  
  // Drill Mode State
  const [isDrillMode, setIsDrillMode] = useState(false);
  const [drillQueue, setDrillQueue] = useState([]);
  const [recurringQueue, setRecurringQueue] = useState([]);
  const [isStartingReview, setIsStartingReview] = useState(false);
  const [initialQueueSize, setInitialQueueSize] = useState(0); 
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [queueStats, setQueueStats] = useState({ flash: 0, mcq: 0, cloze: 0, nuance: 0, register: 0, mono: 0 });
  const [nuanceFeedback, setNuanceFeedback] = useState(null);
  const [mcqFeedback, setMcqFeedback] = useState(null);

  // PAIN Modals & Form
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showPainImportModal, setShowPainImportModal] = useState(false);
  const [newCard, setNewCard] = useState({ hanzi: '', pinyin: '', meaning: '', notes: '', category: 'Harvested Text', tags: '', example: '', example_meaning: '', distractors: '', nuance_tip: '', register: '', definition_cn: '' });
  const [painImportInput, setPainImportInput] = useState('');
  const [painImportError, setPainImportError] = useState('');
  const [painImportPreview, setPainImportPreview] = useState(null);
  const [drillConfig, setDrillConfig] = useState({ limit: 25, scope: 'due', tag: 'All', flash: true, mcq: true, cloze: true, nuance: true, register: true, mono: true });
  const cloudArchiveId = configuredCloudArchiveId || user?.uid || 'local-archive';

  // Refs
  const fileInputRef = useRef(null);
  const tsvInputRef = useRef(null);
  const painFileInputRef = useRef(null);
  const baseKnowledgeInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const isRapidFiringRef = useRef(false);
  const preservedLocalArchiveRef = useRef(readLocalStore());

  // --- GLOBALS & HANDLERS ---
  const toggleScript = useCallback(() => setScript(prev => prev === 'SC' ? 'TC' : 'SC'), []);
  const closeModal = useCallback(() => { setSelection(null); setReaderPanelOpen(false); window.getSelection()?.removeAllRanges(); }, []);
  const reportProgress = useCallback((label, current = 0, total = 0, scope = 'global') => {
      setImportProgress({ label, current, total, scope });
      setSyncStatus(total ? `${label}: ${current} / ${total}` : label);
  }, []);
  const clearProgressSoon = useCallback((message = '') => {
      if (message) setSyncStatus(message);
      setTimeout(() => setImportProgress(null), 1200);
  }, []);
  const openPainImportModal = useCallback(() => {
      setPainImportError('');
      setImportProgress(null);
      setSyncStatus('');
      setShowPainImportModal(true);
  }, []);
  const closePainImportModal = useCallback(() => {
      if (isProcessing) {
          setSyncStatus('Import is still running. Wait for the progress counter to finish.');
          return;
      }
      setShowPainImportModal(false);
      setPainImportError('');
      setImportProgress(null);
  }, [isProcessing]);

  useEffect(() => {
      readLocalStoreAsync().then(local => {
          if (local) preservedLocalArchiveRef.current = local;
      });
  }, []);

  useEffect(() => {
      if (!window.speechSynthesis) return;
      const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices().filter(voice => voice.lang?.toLowerCase().startsWith('zh')));
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
      localStorage.setItem(`${LOCAL_STORE_KEY}-voice`, JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  // --- FIREBASE LIFECYCLE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Failure:", err);
        setSyncStatus("Firebase sign-in failed. In Firebase Console, enable Authentication > Sign-in method > Anonymous.");
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
         const local = await readLocalStoreAsync();
         preservedLocalArchiveRef.current = local;
         setLibrary(local?.library?.length ? local.library : [DEMO_MANUSCRIPT]);
         setCards(local?.cards || []);
         setUserDict(local?.userDict || {});
         setActivityData(local?.activityData || []);
         setConversionCodex(local?.conversionCodex || {});
         setRecentHarvests(local?.recentHarvests || []);
         setSegmentationOverrides(local?.segmentationOverrides || {});
         setSegmentAnnotations(local?.segmentAnnotations || {});
         setLocalReady(true);
         setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user || !localReady || loading) return;
    const payload = {
        library,
        cards,
        userDict,
        activityData,
        conversionCodex,
        recentHarvests,
        segmentationOverrides,
        segmentAnnotations
    };
    const timer = setTimeout(() => {
        writeLocalStoreAsync(payload).then((ok) => {
            if (!ok) setSyncStatus("Local storage is full. Data is still on screen; enable cloud sync or export a backup before closing.");
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [user, localReady, loading, library, cards, userDict, activityData, conversionCodex, recentHarvests, segmentationOverrides, segmentAnnotations]);

  useEffect(() => {
    if (!user) return;
    setCloudStateReady(false);

    // Stream Manuscripts
    const msRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'manuscripts');
    const handleCloudStreamError = (err) => {
        console.error("Cloud stream failed:", err);
        setSyncStatus("Cloud connection failed. Check Firestore Database is created and its security rules allow signed-in users.");
        setLoading(false);
    };

    const unsubMs = onSnapshot(msRef, (snap) => {
        const msArr = assembleCloudManuscripts(snap.docs);
        msArr.sort((a, b) => new Date(b.date) - new Date(a.date));
        setLibrary(msArr);
    }, handleCloudStreamError);

    // Stream Reader Dictionary (Lexicon)
    const dictRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'dictionary');
    const unsubDict = onSnapshot(dictRef, (snap) => {
        const dictMap = {};
        snap.forEach(doc => { dictMap[doc.id] = doc.data(); });
        setUserDict(dictMap);
    }, handleCloudStreamError);

    // Stream PAIN Vocabulary (Flashcards)
    const vocabRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary');
    const unsubVocab = onSnapshot(vocabRef, (snap) => {
        const fetchedCards = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCards(fetchedCards);
        setLoading(false);
    }, handleCloudStreamError);

    // Stream Activity Log (Stats)
    const activityRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'activity');
    const unsubActivity = onSnapshot(activityRef, (snap) => {
        const arr = [];
        snap.forEach(doc => arr.push(doc.data()));
        setActivityData(arr);
    }, handleCloudStreamError);

    const appStateRef = doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'appState', 'current');
    const unsubAppState = onSnapshot(appStateRef, (snap) => {
        const state = snap.exists?.() ? snap.data() : {};
        setConversionCodex(state.conversionCodex || {});
        setRecentHarvests(state.recentHarvests || []);
        setSegmentationOverrides(state.segmentationOverrides || {});
        setSegmentAnnotations(state.segmentAnnotations || {});
        if (state.script === 'SC' || state.script === 'TC') setScript(state.script);
        if (state.mode === 'bilingual' || state.mode === 'monolingual') setMode(state.mode);
        setCloudStateReady(true);
    }, handleCloudStreamError);

    return () => { unsubMs(); unsubDict(); unsubVocab(); unsubActivity(); unsubAppState(); };
  }, [user]);

  useEffect(() => {
    if (!user || !cloudStateReady) return;
    const timer = setTimeout(() => {
        const appStateRef = doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'appState', 'current');
        setDoc(appStateRef, {
            conversionCodex,
            recentHarvests,
            segmentationOverrides,
            segmentAnnotations,
            script,
            mode,
            updatedAt: new Date().toISOString()
        }, { merge: true }).catch(err => {
            console.error("Cloud app state sync failed:", err);
            setSyncStatus("Text settings sync failed. Check Firestore rules.");
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [user, cloudStateReady, conversionCodex, recentHarvests, segmentationOverrides, segmentAnnotations, script, mode]);

  // Derive Active Data
  const activeManuscript = library.find(m => m.id === activeManuscriptId) || null;
  const data = activeManuscript ? activeManuscript.content : [];

  // ==========================================
  // === ACTIVITY SURVEILLANCE MATRIX ===
  // ==========================================
  const trackActivity = useCallback((fields) => {
      const dateStr = new Date().toISOString().split('T')[0];
      if (!user) {
          setActivityData(prev => {
              const existing = prev.find(item => item.date === dateStr) || { date: dateStr };
              const nextItem = { ...existing };
              Object.entries(fields).forEach(([key, val]) => { nextItem[key] = (nextItem[key] || 0) + val; });
              return [...prev.filter(item => item.date !== dateStr), nextItem];
          });
          return;
      }
      
      const docRef = doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'activity', dateStr);
      
      const updates = { date: dateStr };
      for (const [key, val] of Object.entries(fields)) {
          updates[key] = increment(val);
      }
      
      setDoc(docRef, updates, { merge: true }).catch(err => console.error("Surveillance metric drop:", err));
  }, [user]);

  // ==========================================
  // === ORTHOGRAPHIC CONVERSION ENGINE =======
  // ==========================================
  const contextConvert = useCallback((text) => {
      if (!text) return "";
      let result = ""; let i = 0;
      while (i < text.length) {
          let matched = false;
          for (let len = 6; len > 1; len--) {
              if (i + len <= text.length) {
                  const sub = text.substring(i, i + len);
                  if (conversionCodex[sub]) { result += conversionCodex[sub]; i += len; matched = true; break; }
              }
          }
          if (!matched) { result += FALLBACK_SC_TC_MAP[text[i]] || text[i]; i++; }
      }
      return result;
  }, [conversionCodex]);

  const convertToSC = useCallback((text) => {
      if (!text) return "";
      let result = ""; let i = 0;
      const invertedCodex = {};
      Object.entries(conversionCodex).forEach(([sc, tc]) => invertedCodex[tc] = sc);

      while (i < text.length) {
          let matched = false;
          for (let len = 6; len > 1; len--) {
              if (i + len <= text.length) {
                  const sub = text.substring(i, i + len);
                  if (invertedCodex[sub]) { result += invertedCodex[sub]; i += len; matched = true; break; }
              }
          }
          if (!matched) { result += FALLBACK_TC_SC_MAP[text[i]] || text[i]; i++; }
      }
      return result;
  }, [conversionCodex]);

  // ==========================================
  // === THE BRIDGE: INJECT INTO PAIN ENGINE ===
  // ==========================================
  const injectIntoPAIN = async (term, dictData, contextSentence = '', contextTranslation = '') => {
      setIsProcessing(true);
      try {
          const exists = cards.find(c => c.hanzi === term);
          if (exists) {
              if(!window.confirm(`"${term}" already exists in the PAIN engine. Inject anyway?`)) {
                  setIsProcessing(false);
                  return;
              }
          }

          const newVocabCard = {
              hanzi: term,
              pinyin: dictData?.pinyin || '',
              meaning: dictData?.def || dictData?.meaning || '',
              category: dictData?.category || (activeManuscript ? activeManuscript.category : 'Harvested Text'),
              notes: dictData?.notes || '',
              example: contextSentence || dictData?.example || '',
              example_meaning: contextTranslation || dictData?.example_meaning || '',
              distractors: dictData?.distractors || '',
              nuance_tip: dictData?.nuance_tip || '',
              register: dictData?.register || '',
              definition_cn: dictData?.definition_cn || '',
              ...createStats()
          };
          
          if (user) {
              await addDoc(collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary'), newVocabCard);
          } else {
              setCards(prev => [{ ...newVocabCard, id: makeId('card') }, ...prev]);
          }
          setRecentHarvests(prev => [{ term, meaning: newVocabCard.meaning, source: activeManuscript?.title || 'Manual lookup' }, ...prev.filter(item => item.term !== term)].slice(0, 8));
          trackActivity({ injections: 1 });
      } catch (err) {
          console.error("Injection failed:", err);
          alert("Failed to inject term into the neural schema.");
      } finally {
          setIsProcessing(false);
      }
  };


  // ==========================================
  // === READER LOGIC (Hemisphere L) ========
  // ==========================================

  const saveManuscript = async (manuscript) => {
      if (!user) {
          setLibrary(prev => [manuscript, ...prev.filter(item => item.id !== manuscript.id)]);
          return;
      }
      try {
          const msRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'manuscripts');
          const { meta, chunks } = splitManuscriptForCloud(manuscript);
          await withCloudTimeout(setDoc(doc(msRef, manuscript.id), meta), 'Text metadata upload');
          for (let i = 0; i < chunks.length; i += CLOUD_BATCH_SIZE) {
              const batch = writeBatch(db);
              chunks.slice(i, i + CLOUD_BATCH_SIZE).forEach(chunk => batch.set(doc(msRef, chunk.id), chunk));
              await withCloudTimeout(batch.commit(), 'Text chunk upload');
              reportProgress('Uploading text chunks', Math.min(i + CLOUD_BATCH_SIZE, chunks.length), chunks.length);
          }
      } catch (err) {
          console.error("Failed to commit manuscript:", err);
          setSyncStatus("Text upload failed. The text may be too large or Firestore rules may be blocking it.");
          throw err;
      }
  };

  const deleteManuscript = async (id, e) => {
      e.stopPropagation();
      if (!window.confirm("Purge this text from existence?")) return;
      if (!user) {
          setLibrary(prev => prev.filter(item => item.id !== id));
          if (activeManuscriptId === id) setActiveManuscriptId(null);
          return;
      }
      try {
          const msRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'manuscripts');
          const snapshot = await getDocs(msRef);
          const batch = writeBatch(db);
          snapshot.docs
              .filter(snapshotDoc => snapshotDoc.id === id || snapshotDoc.id.startsWith(`${id}__chunk__`))
              .forEach(snapshotDoc => batch.delete(doc(msRef, snapshotDoc.id)));
          await batch.commit();
          if (activeManuscriptId === id) setActiveManuscriptId(null);
      } catch (err) { console.error("Purge failed:", err); }
  };

  const saveVocabBatch = async (dictEntries) => {
      setIsProcessing(true);
      const entries = Object.entries(dictEntries);
      reportProgress('Preparing glossary upload', 0, entries.length);
      if (!user) {
          setUserDict(prev => ({ ...prev, ...dictEntries }));
          reportProgress('Glossary stored locally', entries.length, entries.length);
          setIsProcessing(false);
          clearProgressSoon(`Stored ${entries.length} glossary terms locally.`);
          return;
      }
      try {
          for (let i = 0; i < entries.length; i += CLOUD_BATCH_SIZE) {
              const batch = writeBatch(db);
              const chunk = entries.slice(i, i + CLOUD_BATCH_SIZE);
              chunk.forEach(([term, data]) => {
                  const safeId = term.replace(/\//g, '_');
                  const docRef = doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'dictionary', safeId);
                  batch.set(docRef, data);
              });
              await withCloudTimeout(batch.commit(), 'Glossary upload');
              reportProgress('Uploading glossary terms', Math.min(i + chunk.length, entries.length), entries.length);
          }
          clearProgressSoon(`Uploaded ${entries.length} glossary terms.`);
      } catch (err) {
          console.error("Vocab ingestion failed:", err);
          setSyncStatus("Glossary upload failed. Check connection and Firestore rules.");
      } finally { setIsProcessing(false); }
  };

  const deleteVocabTerm = async (term) => {
      if (!user) {
          setUserDict(prev => {
              const next = { ...prev };
              delete next[term];
              return next;
          });
          setSelectedGlossaryTerms(prev => {
              const next = new Set(prev);
              next.delete(term);
              return next;
          });
          return;
      }
      try { await deleteDoc(doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'dictionary', term.replace(/\//g, '_'))); } 
      catch (err) { console.error("Failed to delete term:", err); }
  };

  const handleBulkInject = async () => {
      if (selectedGlossaryTerms.size === 0) return;
      setIsProcessing(true);
      
      const termsArray = Array.from(selectedGlossaryTerms);
      const collRef = user ? collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary') : null;
      
      let count = 0;
      try {
          for (let i = 0; i < termsArray.length; i += 500) {
              const batch = writeBatch(db);
              const chunk = termsArray.slice(i, i + 500);
              chunk.forEach(term => {
                  const dictData = userDict[term];
                  if(dictData && !cards.find(c => c.hanzi === term)) {
                      const item = {
                          ...dictData,
                          ...createStats()
                      };
                      if (user) batch.set(doc(collRef), item);
                      else setCards(prev => [{ ...item, id: makeId('card') }, ...prev]);
                      count++;
                  }
              });
              if (user) await batch.commit();
          }
          if(count > 0) {
              alert(`Successfully injected ${count} terms into the PAIN Engine.`);
              trackActivity({ injections: count });
          } else {
              alert("Selected terms already exist in the PAIN Engine.");
          }
      } catch(err) {
          console.error(err);
          alert("Injection failed.");
      }
      setSelectedGlossaryTerms(new Set());
      setIsProcessing(false);
  };

  // --- OUT-OF-VOCABULARY (OOV) EXTRACTION ---
  const harvestUnknownWords = () => {
      if (!activeManuscript || typeof Intl === 'undefined' || !('Segmenter' in Intl)) {
          alert("Browser segmentation API not supported or no active manuscript.");
          return;
      }
      
      const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
      const unknowns = new Set();
      
      data.forEach(segment => {
          const textToSegment = segment.sc; 
          if (!textToSegment) return;
          const iterator = segmenter.segment(textToSegment);
          for (const seg of iterator) {
              const word = seg.segment.trim();
              if (word.length === 0 || /^[\p{P}\p{S}\p{Z}\p{N}a-zA-Z]+$/u.test(word)) continue;
              const inLexicon = !!userDict[word];
              const inPAIN = cards.some(c => c.hanzi === word);
              const inMock = !!MOCK_DICT[word];
              if (!inLexicon && !inPAIN && !inMock) unknowns.add(word);
          }
      });
      
      setHarvestedWords(Array.from(unknowns));
      setShowHarvestModal(true);
  };

  const copyHarvestToClipboard = () => {
      const textToCopy = harvestedWords.join('\n');
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      try {
          document.execCommand('copy');
          alert('Lexical voids copied to clipboard. Feed them to the Orion Protocol.');
      } catch (err) {
          alert('System interference. Please copy the text manually from the text area.');
      }
      document.body.removeChild(textarea);
  };

  const injectHarvestedWords = async () => {
      if (harvestedWords.length === 0) return;
      setIsProcessing(true);
      try {
          const newCards = harvestedWords
              .filter(term => !cards.some(card => card.hanzi === term))
              .map(term => ({
                  id: makeId('card'),
                  hanzi: term,
                  term,
                  pinyin: '',
                  meaning: 'Define this harvested term.',
                  category: activeManuscript?.category || 'Harvested Text',
                  notes: `Harvested from ${activeManuscript?.title || 'reader'}`,
                  example: activeManuscript?.content?.find(seg => seg.sc?.includes(term))?.sc || '',
                  example_meaning: activeManuscript?.content?.find(seg => seg.sc?.includes(term))?.en || '',
                  distractors: '',
                  nuance_tip: '',
                  register: '',
                  definition_cn: '',
                  ...createStats()
              }));
          if (newCards.length === 0) return alert("Harvested terms are already in the PAIN Engine.");
          if (user) {
              const collRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary');
              const batch = writeBatch(db);
              newCards.forEach(card => batch.set(doc(collRef), card));
              await batch.commit();
          } else {
              setCards(prev => [...newCards, ...prev]);
          }
          setRecentHarvests(prev => [...newCards.map(card => ({ term: card.hanzi, meaning: card.meaning, source: activeManuscript?.title || 'Reader' })), ...prev].slice(0, 8));
          trackActivity({ injections: newCards.length });
          setShowHarvestModal(false);
      } catch (err) {
          console.error(err);
          alert("Harvest injection failed.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleTextMouseUp = (segmentId) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    let text = sel.toString().trim();
    if (script === 'TC') text = convertToSC(text);
    if (text.length > 0) {
        setSelection({ text, segmentId });
        const segment = data.find(s => s.id === segmentId);
        const defaultSegments = segmentationOverrides[segmentId] || (segment?.sc ? Array.from(new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(segment.sc)).map(s => s.segment) : []);
        setSegmentationDraft(defaultSegments.join(' '));
        setAnnotationDraft(segmentAnnotations[segmentId] || '');
        setReaderPanelOpen(true);
        trackActivity({ lookups: 1 });
    }
  };

  const handleCharClick = (char, segmentId) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (/[，。！？；：、「」『』]/.test(char)) return;
    let logicalChar = script === 'TC' ? convertToSC(char) : char;
    setSelection({ text: logicalChar, segmentId });
    const segment = data.find(s => s.id === segmentId);
    const defaultSegments = segmentationOverrides[segmentId] || (segment?.sc ? Array.from(new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(segment.sc)).map(s => s.segment) : []);
    setSegmentationDraft(defaultSegments.join(' '));
    setAnnotationDraft(segmentAnnotations[segmentId] || '');
    setReaderPanelOpen(true);
    trackActivity({ lookups: 1 });
  };

  const handleSpeak = useCallback((text, e) => {
      if (e) e.stopPropagation();
      if (!text || !window.speechSynthesis) return;
      if (isRapidFiringRef.current) return; // Prevent thread choking during rapid drill
      
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = Number(voiceSettings.rate) || 0.8;
      const chosenVoice = availableVoices.find(voice => voice.voiceURI === voiceSettings.voiceURI);
      if (chosenVoice) utterance.voice = chosenVoice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
  }, [availableVoices, voiceSettings]);

  const handleReaderFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
      processIngestedText(e.target?.result, file.name.endsWith('.json') ? 'json' : 'text', defaultTitle);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLexiconTSVUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        const parsedData = parseCSV(e.target?.result);
        const newVocab = {};
        parsedData.forEach(cols => {
            if (cols.length >= 2 && cols[0].trim()) {
                const term = cols[0].trim();
                newVocab[term] = {
                    term: term, hanzi: term,
                    pinyin: cols[1]?.trim() || "",
                    meaning: cols[2]?.trim() || "",
                    category: cols[3]?.trim() || 'Imported Lexicon',
                    notes: cols[4]?.trim() || "",
                    example: cols[5]?.trim() || "",
                    example_meaning: cols[6]?.trim() || "",
                    distractors: cols[7]?.trim() || "",
                    nuance_tip: cols[8]?.trim() || "",
                    register: cols[9]?.trim() || "",
                    definition_cn: cols[10]?.trim() || ""
                };
            }
        });
        await saveVocabBatch(newVocab);
        if (tsvInputRef.current) tsvInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = async () => {
      const title = importTitle.trim() || `Untitled Fragment ${new Date().toLocaleTimeString()}`;
      if (!manuscriptPreview) {
          const lines = ingestTab === 'align'
              ? alignSource.split(/\r?\n/).filter(line => line.trim() !== '')
              : pasteContent.split(/\r?\n/).filter(line => line.trim() !== '');
          setManuscriptPreview({
              title,
              mode: ingestTab === 'align' ? 'Parallel Align' : (lines.some(line => line.includes('\t')) ? 'Bilingual TSV' : 'Monolingual'),
              rows: lines.length,
              samples: lines.slice(0, 4)
          });
          return;
      }
      setIsProcessing(true);
      try {
          if (ingestTab === 'align' && alignSource.trim() && alignTarget.trim()) await processAlignedImport(alignSource, alignTarget, title);
          else if (ingestTab === 'codex' && pasteContent.trim()) processCodexImport(pasteContent);
          else if (pasteContent.trim()) await processIngestedText(pasteContent, 'text', title);
          setPasteContent(''); setAlignSource(''); setAlignTarget(''); setImportTitle(''); setManuscriptPreview(null); setShowPasteModal(false);
      } finally {
          setIsProcessing(false);
      }
  };

  const processCodexImport = (content) => {
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      const newRules = {};
      lines.forEach(line => {
          const parts = line.split('\t');
          if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) newRules[parts[0].trim()] = parts[1].trim();
      });
      setConversionCodex(prev => ({ ...prev, ...newRules }));
  };

  const processAlignedImport = async (srcText, trgText, title) => {
      reportProgress('Aligning text', 0, 1);
      const srcLines = srcText.split(/\r?\n/).filter(line => line.trim() !== '');
      const trgLines = trgText.split(/\r?\n/).filter(line => line.trim() !== '');
      const alignedData = galeChurchAlign(srcLines, trgLines);
      reportProgress('Saving aligned text', 0, alignedData.length);
      const newSegments = alignedData.map((pair, idx) => ({
          id: `align-${Date.now()}-${idx}`, sc: pair.sc, tc: contextConvert(pair.sc), en: pair.en, pinyin: "", category: 'Lit'
      }));
      const ms = { id: `ms-${Date.now()}`, title, date: new Date().toISOString(), category: 'Lit', content: newSegments };
      await saveManuscript(ms); setActiveManuscriptId(ms.id); setMode('bilingual');
      reportProgress('Text saved', newSegments.length, newSegments.length);
      clearProgressSoon(`Saved text with ${newSegments.length} aligned segments.`);
  };

  const processIngestedText = async (content, type, title) => {
      try {
        reportProgress('Parsing text', 0, 1);
        let newSegments = []; let detectedMode = 'monolingual'; 
        if (type === 'json') {
          const parsed = JSON.parse(content);
          const validContent = Array.isArray(parsed.content) ? parsed.content : (Array.isArray(parsed) ? parsed : null);
          if (validContent) {
            newSegments = validContent.map((item, idx) => {
              const source = item.source || item.sc || "Unknown";
              return {
                id: item.id || `ingest-${Date.now()}-${idx}`, sc: source, tc: item.tc || contextConvert(source),
                en: item.reference || item.en || null, pinyin: item.pinyin || "", category: item.category || 'Lit'
              };
            });
            detectedMode = 'bilingual'; if (parsed.meta?.title) title = parsed.meta.title;
          }
        } else {
          const textLines = content.split(/\r?\n/).filter(line => line.trim() !== '');
          if (textLines.length === 0) throw new Error("No text lines found.");
          reportProgress('Parsing text lines', 0, textLines.length);
          newSegments = textLines.map((line, idx) => {
              const parts = line.split('\t'); const sc = parts[0]?.trim() || "";
              if (parts.length > 1) detectedMode = 'bilingual';
              return {
                  id: `txt-${Date.now()}-${idx}`, sc, tc: parts[1] && parts[1] !== parts[2] ? parts[1].trim() : contextConvert(sc),
                  en: parts.length > 2 ? parts[2].trim() : (parts[1] || null), pinyin: "", category: 'Lit'
              };
          });
        }
        if (newSegments.length === 0) throw new Error("No valid text segments found.");
        reportProgress('Saving text', 0, newSegments.length);
        const ms = { id: `ms-${Date.now()}`, title, date: new Date().toISOString(), category: 'Lit', content: newSegments };
        await saveManuscript(ms); setActiveManuscriptId(ms.id); setMode(detectedMode);
        reportProgress('Text saved', newSegments.length, newSegments.length);
        clearProgressSoon(`Saved text with ${newSegments.length} segments.`);
      } catch (err) {
        console.error("Text ingestion failed:", err);
        setSyncStatus(`Text ingestion failed: ${err.message || 'invalid input'}`);
        alert("Ingestion structurally compromised.");
      }
  };

  const getLookupResult = (term) => {
      if (userDict[term]) return userDict[term];
      if (MOCK_DICT[term]) return MOCK_DICT[term];
      return { pinyin: '...', def: 'Absent from schema.', meaning: 'Absent from schema.' };
  };

  // ==========================================
  // === MASS BASE KNOWLEDGE ASSIMILATION ===
  // ==========================================
  const handleBaseKnowledgeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            reportProgress('Parsing base data', 0, 1, 'pain-import');
            const parsedData = parseCSV(e.target.result);
            const validData = parsedData.map(cols => {
                if (cols.length < 2 || !cols[0].trim()) return null;
                const term = cols[0].trim();
                return {
                    hanzi: term, term: term,
                    pinyin: cols[1]?.trim() || "",
                    meaning: cols[2]?.trim() || "",
                    category: cols[3]?.trim() || 'Base Knowledge (HSK)',
                    notes: cols[4]?.trim() || "",
                    example: cols[5]?.trim() || "",
                    example_meaning: cols[6]?.trim() || "",
                    distractors: cols[7]?.trim() || "",
                    nuance_tip: cols[8]?.trim() || "",
                    register: cols[9]?.trim() || "",
                    definition_cn: cols[10]?.trim() || "",
                    streak: 0,
                    views_forward: 0, correct_forward: 0, incorrect_forward: 0,
                    views_reverse: 0, correct_reverse: 0, incorrect_reverse: 0,
                    views_cloze: 0, correct_cloze: 0, incorrect_cloze: 0,
                    isMastered: false
                };
            }).filter(Boolean);

            if (validData.length === 0) throw new Error("No valid data found.");
            reportProgress('Parsed base data', validData.length, validData.length, 'pain-import');

            const localReadyData = validData.map(item => ({ ...createStats(), ...item, id: item.id || makeId('card') }));
            const dictMap = {};
            localReadyData.forEach(item => { dictMap[item.hanzi] = item; });
            setCards(prev => [...localReadyData, ...prev]);
            setUserDict(prev => ({ ...prev, ...dictMap }));
            reportProgress(user ? 'Base data ready locally; uploading cloud copy' : 'Saving base data locally', 0, validData.length, 'pain-import');

            if (!user) {
                reportProgress('Base data stored locally', validData.length, validData.length, 'pain-import');
                clearProgressSoon(`Stored ${validData.length} base items locally.`);
                trackActivity({ injections: validData.length });
                setShowPainImportModal(false);
                return;
            }

            const vocabRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary');
            const dictRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'dictionary');
            
            let batches = [];
            let currentBatch = writeBatch(db);
            let opCount = 0;
            let itemsInCurrentBatch = 0;
            let committedItems = 0;

            for (const item of localReadyData) {
                currentBatch.set(doc(vocabRef, item.id), item);
                opCount++;
                itemsInCurrentBatch++;
                
                const safeId = item.hanzi.replace(/\//g, '_');
                currentBatch.set(doc(dictRef, safeId), item);
                opCount++;
                if (itemsInCurrentBatch >= CLOUD_BATCH_SIZE || opCount >= CLOUD_BATCH_SIZE * 2) {
                    batches.push({ batch: currentBatch, itemCount: itemsInCurrentBatch });
                    currentBatch = writeBatch(db);
                    opCount = 0;
                    itemsInCurrentBatch = 0;
                }
            }
            if (opCount > 0) batches.push({ batch: currentBatch, itemCount: itemsInCurrentBatch });

            for (const { batch, itemCount } of batches) {
                reportProgress('Uploading base data', committedItems, validData.length, 'pain-import');
                await withCloudTimeout(batch.commit(), 'Base data upload');
                committedItems = Math.min(validData.length, committedItems + itemCount);
                reportProgress('Uploading base data', committedItems, validData.length, 'pain-import');
            }
            
            clearProgressSoon(`Uploaded ${validData.length} base items.`);
            trackActivity({ injections: validData.length });
            setShowPainImportModal(false);
        } catch(err) {
            console.error(err);
            setPainImportError(`Cloud upload failed: ${err.message || 'unknown error'}. The parsed cards were kept on this device; check Firebase rules/config, then try Push Local Archive.`);
            setSyncStatus(`Base data upload failed: ${err.message || 'unknown error'}`);
        } finally {
            setIsProcessing(false);
            if (baseKnowledgeInputRef.current) baseKnowledgeInputRef.current.value = null;
        }
    };
    reader.readAsText(file);
  };


  // --- PAIN LOGIC (Hemisphere R) ========

  const painImportAnalysis = useMemo(() => {
    if (!painImportInput.trim()) return null;
    try {
        let parsed = [];
        try {
            const json = JSON.parse(painImportInput);
            parsed = Array.isArray(json) ? json.map(item => ({ ...createStats(), ...item, id: item.id || makeId('card') })) : [];
        } catch (err) {
            parsed = parseCSV(painImportInput).map(cols => normalizeVocabRow(cols, 'Imported')).filter(Boolean);
        }
        const existing = new Set(cards.map(card => card.hanzi));
        const seen = new Set();
        const issues = [];
        const valid = [];
        parsed.forEach((item, index) => {
            const rowIssues = [];
            if (!item.hanzi?.trim()) rowIssues.push('Missing Hanzi');
            if (!item.meaning?.trim()) rowIssues.push('Missing meaning');
            if (existing.has(item.hanzi)) rowIssues.push('Already in PAIN');
            if (seen.has(item.hanzi)) rowIssues.push('Duplicate in import');
            seen.add(item.hanzi);
            if (rowIssues.length) issues.push({ index: index + 1, term: item.hanzi || '(blank)', issues: rowIssues });
            else valid.push(item);
        });
        return { valid, issues, total: parsed.length };
    } catch (err) {
        return { valid: [], issues: [{ index: 0, term: 'Import', issues: ['Could not parse data'] }], total: 0 };
    }
  }, [painImportInput, cards]);

  const filteredCards = useMemo(() => {
    let result = cards.filter(card => card.isMastered !== true && isReviewableCard(card));
    if (selectedCategory !== 'All') result = result.filter(card => card.category === selectedCategory);
    return result.length > 0 ? result : [];
  }, [cards, selectedCategory]);

  const dueCards = useMemo(() => {
    const today = todayKey();
    return filteredCards.filter(card => !card.dueDate || card.dueDate <= today);
  }, [filteredCards]);

  const reviewCards = reviewMode === 'due' ? dueCards : filteredCards;
  const activeReviewQueue = isReviewSession && recurringQueue.length > 0 ? recurringQueue : reviewCards;
  const cardTags = useMemo(() => ['All', ...new Set(cards.flatMap(card => Array.isArray(card.tags) ? card.tags : String(card.tags || '').split(',').map(tag => tag.trim()).filter(Boolean)))].sort(), [cards]);

  const lexiconCategories = useMemo(() => ['All', ...new Set(Object.values(userDict).map(item => item.category || 'Uncategorized'))].sort(), [userDict]);

  const filteredLexiconEntries = useMemo(() => {
    const query = lexiconSearch.trim().toLowerCase();
    return Object.entries(userDict).filter(([term, data]) => {
        const matchesQuery = !query || [term, data.pinyin, data.meaning, data.def, data.notes].some(value => String(value || '').toLowerCase().includes(query));
        const matchesCategory = lexiconCategory === 'All' || (data.category || 'Uncategorized') === lexiconCategory;
        return matchesQuery && matchesCategory;
    });
  }, [userDict, lexiconSearch, lexiconCategory]);

  const dashboard = useMemo(() => {
      const reviews = cards.reduce((sum, card) => sum + (card.views_forward || 0) + (card.views_reverse || 0) + (card.views_cloze || 0), 0);
      const correct = cards.reduce((sum, card) => sum + (card.correct_forward || 0) + (card.correct_reverse || 0) + (card.correct_cloze || 0), 0);
      const weak = cards.filter(card => (card.streak || 0) < 0 && !card.isMastered).length;
      const mastered = cards.filter(card => card.isMastered || (card.streak || 0) >= 50).length;
      const newCards = cards.filter(card => ((card.views_forward || 0) + (card.views_reverse || 0) + (card.views_cloze || 0)) === 0).length;
      const due = cards.filter(card => !card.isMastered && (!card.dueDate || card.dueDate <= todayKey())).length;
      return {
          manuscripts: library.length,
          glossary: Object.keys(userDict).length,
          cards: cards.length,
          reviews,
          accuracy: reviews ? Math.round((correct / reviews) * 100) : 0,
          weak,
          mastered,
          newCards,
          due
      };
  }, [cards, library.length, userDict]);

  const browserCards = useMemo(() => {
      const query = cardSearch.trim().toLowerCase();
      return cards.filter(card => {
          const views = (card.views_forward || 0) + (card.views_reverse || 0) + (card.views_cloze || 0);
          const due = !card.dueDate || card.dueDate <= todayKey();
          const filterMatch =
              cardFilter === 'all' ||
              (cardFilter === 'due' && due && !card.isMastered) ||
              (cardFilter === 'weak' && (card.streak || 0) < 0) ||
              (cardFilter === 'new' && views === 0) ||
              (cardFilter === 'mastered' && card.isMastered) ||
              (cardFilter === 'missing' && (!card.pinyin || !card.meaning || !card.example));
          const queryMatch = !query || [card.hanzi, card.pinyin, card.meaning, card.category, card.notes, ...(card.tags || [])].some(value => String(value || '').toLowerCase().includes(query));
          return filterMatch && queryMatch;
      });
  }, [cards, cardSearch, cardFilter]);

  const dataAudit = useMemo(() => ({
      missingPinyin: cards.filter(card => !card.pinyin),
      missingExample: cards.filter(card => !card.example),
      missingDistractors: cards.filter(card => !card.distractors),
      missingDefinition: cards.filter(card => !card.definition_cn),
      missingTags: cards.filter(card => !(card.tags || []).length),
      duplicates: Object.entries(cards.reduce((acc, card) => {
          if (!card.hanzi) return acc;
          acc[card.hanzi] = [...(acc[card.hanzi] || []), card];
          return acc;
      }, {})).filter(([, group]) => group.length > 1)
  }), [cards]);

  useEffect(() => {
    if (currentCardIndex >= activeReviewQueue.length && activeReviewQueue.length > 0) setCurrentCardIndex(0);
  }, [activeReviewQueue.length, currentCardIndex]);

  useEffect(() => {
    if (user || loading || cards.length === 0) return;
    setCards(prev => prev.map(card => ({
        ...createStats(),
        ...card,
        tags: Array.isArray(card.tags) ? card.tags : String(card.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
        ease: Number(card.ease || 2.5),
        interval: Number(card.interval || 0),
        dueDate: card.dueDate || todayKey(),
        isMastered: Boolean(card.isMastered)
    })));
  }, [user, loading, cards.length]);

  const activePainCard = useMemo(() => {
    if (isDrillMode) {
        if (drillQueue.length === 0) return null;
        const queueItem = drillQueue[0];
        const freshData = cards.find(c => c.id === queueItem.id);
        if (!freshData) return queueItem; 
        return { 
            ...queueItem, ...freshData, _mode: queueItem._mode, _type: queueItem._type, _options: queueItem._options,
            distractors: freshData.distractors || queueItem.distractors, nuance_tip: freshData.nuance_tip || queueItem.nuance_tip
        };
    } else if (isReviewSession) {
        const queueItem = activeReviewQueue[currentCardIndex];
        if (!queueItem) return null;
        const freshData = cards.find(c => c.id === queueItem.id);
        if (!freshData) return queueItem;
        return {
            ...queueItem, ...freshData, _mode: queueItem._mode, _type: queueItem._type, _options: queueItem._options,
            distractors: freshData.distractors || queueItem.distractors, nuance_tip: freshData.nuance_tip || queueItem.nuance_tip
        };
    }
    return null;
  }, [isDrillMode, isReviewSession, drillQueue, cards, activeReviewQueue, currentCardIndex]);
    
  const isReverse = activePainCard?._mode === 'en-zh';
  const isMcq = ['mcq', 'mcq-cloze', 'mcq-nuance', 'mcq-register', 'mcq-def'].includes(activePainCard?._type);
  const isCloze = activePainCard?._type === 'mcq-cloze';
  const isNuance = activePainCard?._type === 'mcq-nuance';
  const isRegister = activePainCard?._type === 'mcq-register';
  const isMonoDef = activePainCard?._type === 'mcq-def';

  const relationGraph = useMemo(() => {
      const base = activePainCard || cards[0];
      if (!base) return [];
      const chars = new Set(String(base.hanzi || '').split(''));
      const tags = new Set(base.tags || []);
      return cards
          .filter(card => card.id !== base.id)
          .map(card => {
              const sharedChars = String(card.hanzi || '').split('').filter(ch => chars.has(ch)).length;
              const sharedTags = (card.tags || []).filter(tag => tags.has(tag)).length;
              const sameCategory = card.category && card.category === base.category ? 1 : 0;
              return { card, score: sharedChars + sharedTags + sameCategory };
          })
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 12);
  }, [cards, activePainCard]);

  const renderClozeSentence = (sentence, targetWord, isDrill) => {
    if (!sentence) return <span className="text-stone-500 italic font-body">No example available.</span>;
    const displaySentence = script === 'TC' ? contextConvert(sentence) : sentence;
    if (!isDrill || !targetWord) return <span className="font-cn">{displaySentence}</span>;
    
    const displayTargetWord = script === 'TC' ? contextConvert(targetWord) : targetWord;
    const targets = displayTargetWord.split(/[(\uff08]/).map(str => str.replace(/[)\uff09]/g, '').trim()).filter(str => str.length > 0).sort((a, b) => b.length - a.length);
    if (targets.length === 0) return <span className="font-cn">{displaySentence}</span>;
    
    const regex = new RegExp(`(${targets.map(escapeRegExp).join('|')})`, 'gi');
    const parts = displaySentence.split(regex);
    if (parts.length === 1) return <span className="font-cn">{displaySentence}</span>;

    return (
        <span className="break-words break-all font-cn">
            {parts.map((part, i) => {
                const isMatch = targets.some(tgt => tgt.toLowerCase() === part.trim().toLowerCase());
                if (isMatch) return ( <span key={i} className="inline-block border-b-2 border-rose-600 text-transparent bg-rose-950/40 mx-1 min-w-[60px] animate-pulse select-none text-center tracking-widest rounded px-2 font-bold cursor-default align-bottom font-cn">[ ... ]</span> );
                return <React.Fragment key={i}>{part}</React.Fragment>;
            })}
        </span>
    );
  };

  const getStruggleSourceCards = useCallback(() => {
      const today = todayKey();
      let sourceCards = [...filteredCards];
      if (drillConfig.scope === 'due') sourceCards = sourceCards.filter(card => !card.dueDate || card.dueDate <= today);
      if (drillConfig.scope === 'weak') sourceCards = sourceCards.filter(card => (card.streak || 0) < 0);
      if (drillConfig.scope === 'difficult') sourceCards = sourceCards.filter(card => difficultyScore(card) >= 4 || (card.ease || 2.5) < 2.2);
      if (drillConfig.scope === 'new') sourceCards = sourceCards.filter(card => totalReviewsForCard(card) === 0);
      if (drillConfig.scope === 'tag' && drillConfig.tag !== 'All') sourceCards = sourceCards.filter(card => (card.tags || []).includes(drillConfig.tag));
      return sourceCards
          .sort((a, b) => {
              if (drillConfig.scope === 'new') return String(b.dueDate || '').localeCompare(String(a.dueDate || ''));
              return difficultyScore(b) - difficultyScore(a);
          })
          .slice(0, Number(drillConfig.limit) || 25);
  }, [filteredCards, drillConfig]);

  const calculateQueueSize = useCallback(() => {
      let sourceCards = getStruggleSourceCards();
      return [
          drillConfig.flash ? sourceCards.length * 2 : 0,
          drillConfig.mcq ? sourceCards.length : 0,
          drillConfig.cloze ? sourceCards.filter(c => c.example && c.example.trim().length > 0 && c.hanzi).length : 0,
          drillConfig.nuance ? sourceCards.filter(c => c.example && c.distractors).length : 0,
          drillConfig.register ? sourceCards.length : 0,
          drillConfig.mono ? sourceCards.filter(c => c.definition_cn && c.definition_cn.trim().length > 1).length : 0
      ].reduce((sum, count) => sum + count, 0);
  }, [getStruggleSourceCards, drillConfig]);

  const recurringPromptCount = useMemo(() => [
      drillConfig.flash ? reviewCards.length * 2 : 0,
      drillConfig.mcq ? reviewCards.length : 0,
      drillConfig.cloze ? reviewCards.filter(c => c.example && c.example.trim().length > 0 && c.hanzi).length : 0,
      drillConfig.nuance ? reviewCards.filter(c => c.example && c.distractors).length : 0,
      drillConfig.register ? reviewCards.length : 0,
      drillConfig.mono ? reviewCards.filter(c => c.definition_cn && c.definition_cn.trim().length > 1).length : 0
  ].reduce((sum, count) => sum + count, 0), [reviewCards, drillConfig]);

  useEffect(() => {
    if (!autoPlayAudio || !activePainCard || currentAppView !== 'pain') return;
    setNuanceFeedback(null); 
    
    if(isMcq) {
        if(activePainCard._type === 'mcq-cloze' || activePainCard._type === 'mcq-nuance') handleSpeak(activePainCard.example);
        else if(activePainCard._mode === 'zh-en') handleSpeak(activePainCard.hanzi);
        return; 
    }
    if (isReverse && isFlipped) handleSpeak(activePainCard.hanzi);
    if (!isReverse && !isFlipped) {
        const timer = setTimeout(() => handleSpeak(activePainCard.hanzi), 300);
        return () => clearTimeout(timer);
    }
  }, [activePainCard, isFlipped, isReverse, isMcq, autoPlayAudio, handleSpeak, currentAppView]);

  const updateCardStats = useCallback(async (cardId, isRev, resultPayload) => {
    if (!cardId) return;
    
    const cardToUpdate = cards.find(c => c.id === cardId);
    let currentStreak = cardToUpdate?.streak || 0;
    let newStreak = currentStreak;

    let outcome = typeof resultPayload === 'object' ? resultPayload.status : resultPayload;
    let isClozeContext = typeof resultPayload === 'object' ? resultPayload.isCloze : false;
    let drillType = typeof resultPayload === 'object' ? resultPayload.type : null;

    let viewField = isClozeContext ? 'views_cloze' : (isRev ? 'views_reverse' : 'views_forward');
    let correctField = isClozeContext ? 'correct_cloze' : (isRev ? 'correct_reverse' : 'correct_forward');
    let incorrectField = isClozeContext ? 'incorrect_cloze' : (isRev ? 'incorrect_reverse' : 'incorrect_forward');

    const updates = { [viewField]: increment(1) };
    let nextEase = Number(cardToUpdate?.ease || 2.5);
    let nextInterval = Number(cardToUpdate?.interval || 0);
    
    let acts = { reviews: 1 };

    if (outcome === 'correct') {
        updates[correctField] = increment(1);
        newStreak = Math.min(50, currentStreak + 1);
        nextInterval = nextInterval <= 0 ? 1 : (nextInterval < 3 ? 3 : Math.max(4, Math.round(nextInterval * nextEase)));
        nextEase = Math.min(3.2, nextEase + 0.05);
        acts.correct = 1;
    } else if (outcome === 'incorrect') {
        updates[incorrectField] = increment(1);
        newStreak = Math.max(-50, currentStreak - 1);
        nextInterval = 0;
        nextEase = Math.max(1.3, nextEase - 0.25);
        acts.incorrect = 1;
    } else if (outcome === 'mastered') {
        updates[correctField] = increment(1);
        newStreak = 50;
        nextInterval = Math.max(180, nextInterval * 2 || 180);
        nextEase = Math.min(3.5, nextEase + 0.15);
        acts.correct = 1;
        acts.mastered = 1;
    } else {
        nextInterval = Math.max(0, nextInterval);
    }

    if (newStreak >= 50 && currentStreak < 50 && outcome !== 'mastered') acts.mastered = 1;
    if (newStreak <= -50 && currentStreak > -50) acts.necrosis = 1;

    trackActivity(acts);

    updates.streak = newStreak;
    const masteryField = isClozeContext ? 'mastery_cloze' : (drillType === 'mcq-nuance' ? 'mastery_nuance' : (drillType === 'mcq-def' ? 'mastery_mono' : (isRev ? 'mastery_production' : 'mastery_recognition')));
    const masteryDelta = outcome === 'correct' || outcome === 'mastered' ? 10 : (outcome === 'incorrect' ? -8 : 0);
    updates[masteryField] = Math.max(0, Math.min(100, (cardToUpdate?.[masteryField] || 0) + masteryDelta));
    updates.ease = nextEase;
    updates.interval = nextInterval;
    updates.lastReviewed = todayKey();
    updates.dueDate = outcome === 'view' ? (cardToUpdate?.dueDate || todayKey()) : addDaysKey(nextInterval);
    if (Math.abs(newStreak) >= 50) {
        updates.isMastered = true;
    } else {
        updates.isMastered = false; 
    }

    if (!user) {
        setCards(prev => prev.map(card => {
            if (card.id !== cardId) return card;
            const next = { ...card };
            Object.entries(updates).forEach(([key, value]) => {
                next[key] = REVIEW_COUNTER_FIELDS.has(key)
                    ? (next[key] || 0) + value
                    : value;
            });
            return next;
        }));
        return;
    }

    const docRef = doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary', cardId);
    try { await updateDoc(docRef, updates); } catch (err) { console.error("Update stats fail:", err); }
  }, [user, cards, trackActivity]);

  const handlePainNext = useCallback((result = 'view') => {
    if (activeReviewQueue.length === 0) return;
    const card = activeReviewQueue[currentCardIndex];
    if (!card) return;
    const isRev = card._mode === 'en-zh';
    const isClozeType = card._type === 'mcq-cloze';
    const payload = isClozeType || card._type === 'mcq-nuance' || card._type === 'mcq-def'
        ? { status: result, isCloze: isClozeType, type: card._type }
        : result;
    if (isReviewSession) {
        setSessionReport(prev => prev ? {
            ...prev,
            correct: prev.correct + (result === 'correct' ? 1 : 0),
            incorrect: prev.incorrect + (result === 'incorrect' ? 1 : 0),
            skipped: prev.skipped + (result === 'view' ? 1 : 0),
            mastered: prev.mastered + (result === 'mastered' ? 1 : 0),
            missed: result === 'incorrect' ? [{ hanzi: card.hanzi, meaning: card.meaning }, ...prev.missed.filter(item => item.hanzi !== card.hanzi)].slice(0, 8) : prev.missed
        } : prev);
    }
    if ((card.streak || 0) >= 49 && result !== 'mastered' && result === 'correct') updateCardStats(card.id, isRev, 'mastered');
    else updateCardStats(card.id, isRev, payload); 
    setIsFlipped(false);
    setNuanceFeedback(null);
    setMcqFeedback(null);
    if (isReviewSession && result !== 'view' && currentCardIndex + 1 >= activeReviewQueue.length) {
        setSessionCompleted(true);
        return;
    }
    setCurrentCardIndex(prev => (prev + 1) >= activeReviewQueue.length ? 0 : prev + 1);
  }, [currentCardIndex, activeReviewQueue, updateCardStats, isReviewSession]);

  const handlePainPrev = useCallback(() => {
    setIsFlipped(false);
    setNuanceFeedback(null);
    setMcqFeedback(null);
    setCurrentCardIndex(prev => (prev - 1) < 0 ? activeReviewQueue.length - 1 : prev - 1);
  }, [activeReviewQueue.length]);

  const generateDistractors = (target, deck, count = 3) => {
      let others = deck.filter(c => c.id !== target.id);
      if (others.length === 0) return []; 
      const shuffled = [...others];
      for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
      return shuffled.slice(0, count);
  };

  const hasHan = (value) => /[\u3400-\u9fff]/.test(String(value || ''));
  const cleanText = (value) => String(value || '').trim();
  const uniqueOptions = (items, getKey) => {
      const seen = new Set();
      return items.filter(item => {
          const key = cleanText(getKey(item));
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
      });
  };
  const shuffleOptions = (items) => {
      const shuffled = [...items];
      for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
  };
  const makeCardOptions = (card, pool, getKey, count = 4) => {
      const correctKey = cleanText(getKey(card));
      if (!correctKey) return [];
      const candidates = uniqueOptions(pool.filter(item => item.id !== card.id && cleanText(getKey(item)) !== correctKey), getKey);
      const options = [card, ...shuffleOptions(candidates).slice(0, count - 1)];
      return options.length === count ? shuffleOptions(options) : [];
  };
  const makeNuanceOptions = (card, pool) => {
      const rawDistractors = cleanText(card.distractors)
          .split(/[,，;；|]/)
          .map(value => cleanText(value))
          .filter(value => hasHan(value) && value !== cleanText(card.hanzi))
          .map((hanzi, i) => ({ hanzi, isDistractor: true, id: `distractor-${i}-${Math.random()}` }));
      const fallback = pool
          .filter(item => item.id !== card.id && hasHan(item.hanzi))
          .map(item => ({ hanzi: item.hanzi, isDistractor: true, id: `fallback-${item.id}` }));
      const distractors = uniqueOptions([...rawDistractors, ...shuffleOptions(fallback)], item => item.hanzi).slice(0, 3);
      const options = [card, ...distractors];
      return options.length === 4 ? shuffleOptions(options) : [];
  };

  const buildPromptQueue = useCallback((sourceCards, config = drillConfig) => {
    const usableCards = sourceCards.filter(isReviewableCard);
    const chineseCards = usableCards.filter(card => hasHan(card.hanzi));
    const flashcards = config.flash ? usableCards.flatMap(card => [
        { ...card, _mode: 'zh-en', _type: 'flashcard', _uid: Math.random() },
        { ...card, _mode: 'en-zh', _type: 'flashcard', _uid: Math.random() }
    ]) : [];
    const mcqs = config.mcq ? usableCards.map(card => {
        const options = makeCardOptions(card, usableCards, item => item.meaning, 4);
        return options.length === 4 ? { ...card, _mode: 'zh-en', _type: 'mcq', _uid: Math.random(), _options: options } : null;
    }).filter(Boolean) : [];
    const clozeMcqs = config.cloze ? usableCards.filter(card => hasHan(card.example) && hasHan(card.hanzi)).map(card => {
        const options = makeCardOptions(card, chineseCards, item => item.hanzi, 4);
        return options.length === 4 ? { ...card, _mode: 'cloze-hanzi', _type: 'mcq-cloze', _uid: Math.random(), _options: options } : null;
    }).filter(Boolean) : [];
    const nuanceMcqs = config.nuance ? usableCards.filter(card => hasHan(card.example) && hasHan(card.hanzi)).map(card => {
        const options = makeNuanceOptions(card, chineseCards);
        return options.length === 4 ? { ...card, _mode: 'nuance', _type: 'mcq-nuance', _uid: Math.random(), _options: options } : null;
    }).filter(Boolean) : [];
    const registerMcqs = config.register
        ? usableCards
            .map(card => ({ ...card, register: getCardRegister(card), _mode: 'register', _type: 'mcq-register', _uid: Math.random(), _options: registerOptionList() }))
        : [];
    const monoMcqs = config.mono ? usableCards.filter(card => hasHan(card.definition_cn) && cleanText(card.definition_cn).length > 1).map(card => {
        const options = makeCardOptions(card, usableCards.filter(item => hasHan(item.definition_cn) && cleanText(item.definition_cn).length > 1), item => item.definition_cn, 4);
        return options.length === 4 ? { ...card, _mode: 'mono', _type: 'mcq-def', _uid: Math.random(), _options: options } : null;
    }).filter(Boolean) : [];
    const queue = shuffleOptions([...flashcards, ...mcqs, ...clozeMcqs, ...nuanceMcqs, ...registerMcqs, ...monoMcqs]);
    return { queue, stats: { flash: flashcards.length, mcq: mcqs.length, cloze: clozeMcqs.length, nuance: nuanceMcqs.length, register: registerMcqs.length, mono: monoMcqs.length } };
  }, [drillConfig]);

  const startDrillMode = () => {
    if (filteredCards.length === 0) return;
    const flashcards = filteredCards.flatMap(card => [ { ...card, _mode: 'zh-en', _type: 'flashcard', _uid: Math.random() }, { ...card, _mode: 'en-zh', _type: 'flashcard', _uid: Math.random() } ]);
    const mcqs = filteredCards.map(card => ({ ...card, _mode: 'zh-en', _type: 'mcq', _uid: Math.random(), _options: [...generateDistractors(card, filteredCards, 3), card].sort(() => Math.random() - 0.5) }));
    const clozeMcqs = filteredCards.filter(c => c.example && c.example.trim().length > 0 && c.hanzi).map(card => ({ ...card, _mode: 'cloze-hanzi', _type: 'mcq-cloze', _uid: Math.random(), _options: [...generateDistractors(card, filteredCards, 3), card].sort(() => Math.random() - 0.5) }));
    const nuanceMcqs = filteredCards.filter(c => c.example && c.distractors).map(card => ({ ...card, _mode: 'nuance', _type: 'mcq-nuance', _uid: Math.random(), _options: [card, ...card.distractors.split(/[,，]/).map(d => d.trim()).filter(Boolean).map((d, i) => ({ hanzi: d, isDistractor: true, id: `distractor-${i}-${Math.random()}` }))].sort(() => Math.random() - 0.5) }));
    const registerMcqs = filteredCards
        .filter(c => normalizeRegister(c.register))
        .map(card => ({ ...card, register: normalizeRegister(card.register), _mode: 'register', _type: 'mcq-register', _uid: Math.random(), _options: registerOptionList() }));
    const monoMcqs = filteredCards.filter(c => c.definition_cn).map(card => ({ ...card, _mode: 'mono', _type: 'mcq-def', _uid: Math.random(), _options: [...generateDistractors(card, filteredCards, 3), card].sort(() => Math.random() - 0.5) }));

    const queue = [...flashcards, ...mcqs, ...clozeMcqs, ...nuanceMcqs, ...registerMcqs, ...monoMcqs];
    for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }

    setDrillQueue(queue); setInitialQueueSize(queue.length);
    setQueueStats({ flash: flashcards.length, mcq: mcqs.length, cloze: clozeMcqs.length, nuance: nuanceMcqs.length, register: registerMcqs.length, mono: monoMcqs.length });
    setIsDrillMode(true); setSessionCompleted(false); setIsFlipped(false); setNuanceFeedback(null); setMcqFeedback(null);
  };

  const startRecurringPain = () => {
    if (reviewCards.length === 0 || isStartingReview) return;
    setIsStartingReview(true);
    setPainMode('recurring');
    setSyncStatus('Building recurring review...');
    setTimeout(() => {
        const { queue, stats } = buildPromptQueue(reviewCards, drillConfig);
        if (queue.length === 0) {
            setIsStartingReview(false);
            setSyncStatus('');
            alert("Enable at least one recurring prompt type with available cards.");
            return;
        }
        setRecurringQueue(queue);
        setQueueStats(stats);
        setInitialQueueSize(queue.length);
        setSessionReport({ total: queue.length, correct: 0, incorrect: 0, skipped: 0, mastered: 0, missed: [] });
        setIsReviewSession(true);
        setIsDrillMode(false);
        setCurrentCardIndex(0);
        setSessionCompleted(false);
        setIsFlipped(false);
        setNuanceFeedback(null);
        setMcqFeedback(null);
        setIsStartingReview(false);
        setSyncStatus('');
    }, 0);
  };

  const exitPainSession = () => {
    setIsDrillMode(false);
    setIsReviewSession(false);
    setSessionCompleted(false);
    setDrillQueue([]);
    setRecurringQueue([]);
    setIsStartingReview(false);
    setIsFlipped(false);
    setNuanceFeedback(null);
    setMcqFeedback(null);
    setSessionReport(null);
  };

  const exitDrillMode = exitPainSession;

  const startConfiguredDrillMode = () => {
    if (filteredCards.length === 0) return;
    let sourceCards = getStruggleSourceCards();
    if (sourceCards.length === 0) return alert("No cards match the selected drill setup.");
    const built = buildPromptQueue(sourceCards, drillConfig);
    if (built.queue.length === 0) return alert("Enable at least one drill type with available cards.");
    setDrillQueue(built.queue);
    setInitialQueueSize(built.queue.length);
    setQueueStats(built.stats);
    setSessionReport({ total: built.queue.length, correct: 0, incorrect: 0, skipped: 0, mastered: 0, missed: [] });
    setIsDrillMode(true);
    setIsReviewSession(false);
    setSessionCompleted(false);
    setIsFlipped(false);
    setNuanceFeedback(null);
    setMcqFeedback(null);
    return;

    const flashcards = drillConfig.flash ? sourceCards.flatMap(card => [
        { ...card, _mode: 'zh-en', _type: 'flashcard', _uid: Math.random() },
        { ...card, _mode: 'en-zh', _type: 'flashcard', _uid: Math.random() }
    ]) : [];
    const mcqs = drillConfig.mcq ? sourceCards.map(card => ({ ...card, _mode: 'zh-en', _type: 'mcq', _uid: Math.random(), _options: [...generateDistractors(card, sourceCards, 3), card].sort(() => Math.random() - 0.5) })) : [];
    const clozeMcqs = drillConfig.cloze ? sourceCards.filter(c => c.example && c.example.trim().length > 0 && c.hanzi).map(card => ({ ...card, _mode: 'cloze-hanzi', _type: 'mcq-cloze', _uid: Math.random(), _options: [...generateDistractors(card, sourceCards, 3), card].sort(() => Math.random() - 0.5) })) : [];
    const nuanceMcqs = drillConfig.nuance ? sourceCards.filter(c => c.example && c.distractors).map(card => ({ ...card, _mode: 'nuance', _type: 'mcq-nuance', _uid: Math.random(), _options: [card, ...card.distractors.split(/[,，]/).map(d => d.trim()).filter(Boolean).map((d, i) => ({ hanzi: d, isDistractor: true, id: `distractor-${i}-${Math.random()}` }))].sort(() => Math.random() - 0.5) })) : [];
    const registerMcqs = drillConfig.register
        ? sourceCards
            .filter(c => normalizeRegister(c.register))
            .map(card => ({ ...card, register: normalizeRegister(card.register), _mode: 'register', _type: 'mcq-register', _uid: Math.random(), _options: registerOptionList() }))
        : [];
    const monoMcqs = drillConfig.mono ? sourceCards.filter(c => c.definition_cn).map(card => ({ ...card, _mode: 'mono', _type: 'mcq-def', _uid: Math.random(), _options: [...generateDistractors(card, sourceCards, 3), card].sort(() => Math.random() - 0.5) })) : [];

    const queue = [...flashcards, ...mcqs, ...clozeMcqs, ...nuanceMcqs, ...registerMcqs, ...monoMcqs];
    if (queue.length === 0) return alert("Enable at least one drill type with available cards.");
    for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }

    setDrillQueue(queue);
    setInitialQueueSize(queue.length);
    setQueueStats({ flash: flashcards.length, mcq: mcqs.length, cloze: clozeMcqs.length, nuance: nuanceMcqs.length, register: registerMcqs.length, mono: monoMcqs.length });
    setSessionReport({ total: queue.length, correct: 0, incorrect: 0, skipped: 0, mastered: 0, missed: [] });
    setIsDrillMode(true);
    setIsReviewSession(false);
    setSessionCompleted(false);
    setIsFlipped(false);
    setNuanceFeedback(null);
    setMcqFeedback(null);
  };

  const handleDrillAction = useCallback((action, e) => {
    if(e) e.stopPropagation();
    setDrillQueue(prevQueue => {
        if (prevQueue.length === 0) return prevQueue;
        const current = prevQueue[0];
        setSessionReport(prev => prev ? {
            ...prev,
            correct: prev.correct + (action === 'right' ? 1 : 0),
            incorrect: prev.incorrect + (action === 'again' ? 1 : 0),
            skipped: prev.skipped + (action === 'skip' ? 1 : 0),
            mastered: prev.mastered + (action === 'mastered' ? 1 : 0),
            missed: action === 'again' ? [{ hanzi: current.hanzi, meaning: current.meaning }, ...prev.missed.filter(item => item.hanzi !== current.hanzi)].slice(0, 8) : prev.missed
        } : prev);
        const isRev = current._mode === 'en-zh'; const isClozeType = current._type === 'mcq-cloze';
        const freshCard = cards.find(c => c.id === current.id) || current;
        let currentStreak = freshCard.streak || 0;
        const isMercyRule = currentStreak >= 49; 

        let result = action === 'right' ? 'correct' : (action === 'again' ? 'incorrect' : 'view');
        if (action === 'mastered' || (isMercyRule && action === 'right')) result = 'mastered';

        // Fire and forget (Asynchronous execution to unblock UI)
        updateCardStats(current.id, isRev, isClozeType || current._type === 'mcq-nuance' || current._type === 'mcq-def' ? { status: result, isCloze: isClozeType, type: current._type } : result);
        
        const rest = prevQueue.slice(1);
        if (action === 'again') {
            const newQueue = [...rest]; newQueue.splice(Math.min(rest.length, Math.floor(Math.random() * 3) + 2), 0, current); return newQueue;
        } else if ((action === 'skip' || action === 'right') && !isMercyRule && result !== 'mastered') { return [...rest, current]; } 
        else { if (rest.length === 0) setSessionCompleted(true); return rest; }
    });
    setIsFlipped(false); setNuanceFeedback(null); setMcqFeedback(null);
  }, [updateCardStats, cards]);

  const handleMcqSelect = useCallback((selectedOption) => {
     if (!activePainCard || !isMcq || mcqFeedback) return;
     const targetRegister = getCardRegister(activePainCard);
     const correctOption = activePainCard._type === 'mcq-register'
        ? activePainCard._options?.find(option => normalizeRegister(option.value || option.label) === targetRegister)
        : activePainCard._options?.find(option => !option.isDistractor && option.id === activePainCard.id);
     let isCorrect = activePainCard._type === 'mcq-register' ? normalizeRegister(selectedOption.value || selectedOption.label) === targetRegister : (activePainCard._type === 'mcq-nuance' ? (!selectedOption.isDistractor && selectedOption.id === activePainCard.id) : selectedOption.id === activePainCard.id);
     const correctLabel = activePainCard._type === 'mcq-register'
        ? (correctOption?.label || targetRegister || 'Correct option')
        : (isMonoDef ? (correctOption?.definition_cn || activePainCard.definition_cn) : (isCloze || isNuance ? (correctOption?.hanzi || activePainCard.hanzi) : (correctOption?.meaning || activePainCard.meaning)));
     const selectedId = selectedOption.id || selectedOption.value || selectedOption.label;
     const correctId = correctOption?.id || correctOption?.value || correctOption?.label || activePainCard.id;
     setMcqFeedback({
         selectedId,
         isCorrect,
         correctId,
         correctLabel,
         action: isCorrect ? 'right' : 'again'
     });

     let feedbackText = activePainCard._type === 'mcq-nuance' ? (activePainCard.nuance_tip || "Nuance mismatch.") : null;
     if (feedbackText) setNuanceFeedback({ text: feedbackText, type: isCorrect ? 'correct' : 'incorrect' });
  }, [activePainCard, isMcq, mcqFeedback, isCloze, isNuance, isMonoDef]);

  const handlePainDelete = async (e) => {
    e.stopPropagation();
    if (!activePainCard) return;
    if (window.confirm("Delete this card? There is no undo.")) {
      if (!user) {
        setCards(prev => prev.filter(card => card.id !== activePainCard.id));
        return;
      }
      try { await deleteDoc(doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary', activePainCard.id)); } 
      catch (err) { console.error("Error deleting:", err); }
    }
  };

  const updateKnownStatus = useCallback(async (ids, makeKnown = true) => {
      const idList = Array.isArray(ids) ? ids.filter(Boolean) : [ids].filter(Boolean);
      if (idList.length === 0) return;
      const updates = makeKnown ? knownCardFields() : reactivateCardFields();
      if (!user) {
          setCards(prev => prev.map(card => idList.includes(card.id) ? { ...card, ...updates } : card));
          setSelectedCardIds(prev => {
              const next = new Set(prev);
              idList.forEach(id => next.delete(id));
              return next;
          });
          return;
      }
      try {
          const batch = writeBatch(db);
          idList.forEach(id => batch.update(doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary', id), updates));
          await batch.commit();
          setSelectedCardIds(prev => {
              const next = new Set(prev);
              idList.forEach(id => next.delete(id));
              return next;
          });
      } catch (err) {
          console.error("Known status update failed:", err);
          alert("Could not update known status.");
      }
  }, [user]);

  const markActiveCardKnown = useCallback((e) => {
      if (e) e.stopPropagation();
      if (!activePainCard) return;
      if (isDrillMode) handleDrillAction('mastered', e);
      else if (isReviewSession) handlePainNext('mastered');
      else updateKnownStatus(activePainCard.id, true);
  }, [activePainCard, isDrillMode, isReviewSession, handleDrillAction, handlePainNext, updateKnownStatus]);

  const skipActiveCard = useCallback((e) => {
      if (e) e.stopPropagation();
      if (!activePainCard) return;
      if (isDrillMode) handleDrillAction('skip', e);
      else handlePainNext('view');
  }, [activePainCard, isDrillMode, handleDrillAction, handlePainNext]);

  const continueAfterMcq = useCallback((e) => {
      if (e) e.stopPropagation();
      if (!activePainCard || !mcqFeedback) return;
      if (isDrillMode) handleDrillAction(mcqFeedback.action, e);
      else handlePainNext(mcqFeedback.isCorrect ? 'correct' : 'incorrect');
  }, [activePainCard, mcqFeedback, isDrillMode, handleDrillAction, handlePainNext]);

  const handleSaveCloudConfig = () => {
      try {
          const parsed = JSON.parse(cloudConfigDraft || '{}');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error("Config must be a JSON object.");
          localStorage.setItem(CLOUD_CONFIG_STORE_KEY, JSON.stringify(parsed));
          setSyncStatus("Cloud config saved. Reloading to apply it...");
          setTimeout(() => window.location.reload(), 600);
      } catch (err) {
          setSyncStatus("Cloud config is not valid JSON.");
      }
  };

  const handleClearCloudConfig = () => {
      localStorage.removeItem(CLOUD_CONFIG_STORE_KEY);
      setCloudConfigDraft('{}');
      setSyncStatus("Cloud config removed. Reloading into local mode...");
      setTimeout(() => window.location.reload(), 600);
  };

  const verifyCloudWritable = async (label = 'Cloud write test') => {
      if (!user) throw new Error("Cloud is not signed in. Enable Anonymous sign-in in Firebase Authentication, then reload.");
      const testRef = doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'diagnostics', 'write-test');
      try {
          await withCloudTimeout(setDoc(testRef, {
              ok: true,
              label,
              uid: user.uid,
              archive: cloudArchiveId,
              updatedAt: new Date().toISOString()
          }, { merge: true }), label, 15000);
      } catch (err) {
          const detail = err?.code ? `${err.code}: ${err.message || ''}` : (err?.message || 'unknown error');
          throw new Error(`${label} failed before data upload. Firebase path: artifacts/${appId}/users/${cloudArchiveId}. Signed-in uid: ${user.uid}. Details: ${detail}`);
      }
  };

  const writeArchiveToCloud = async (archive = {}) => {
      await verifyCloudWritable('Archive cloud write test');
      const sourceLibrary = archive.library?.length ? archive.library : library;
      const sourceCards = archive.cards?.length ? archive.cards : cards;
      const sourceUserDict = archive.userDict && Object.keys(archive.userDict).length ? archive.userDict : userDict;
      const sourceActivityData = archive.activityData?.length ? archive.activityData : activityData;
      const sourceAppState = {
          conversionCodex: archive.conversionCodex || conversionCodex,
          recentHarvests: archive.recentHarvests || recentHarvests,
          segmentationOverrides: archive.segmentationOverrides || segmentationOverrides,
          segmentAnnotations: archive.segmentAnnotations || segmentAnnotations,
          script,
          mode,
          updatedAt: new Date().toISOString()
      };

      const msRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'manuscripts');
      const vocabRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary');
      const dictRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'dictionary');
      const activityRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'activity');
      const appStateRef = doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'appState', 'current');
      const commitChunks = async (items, writeItem) => {
          for (let i = 0; i < items.length; i += CLOUD_BATCH_SIZE) {
              const batch = writeBatch(db);
              items.slice(i, i + CLOUD_BATCH_SIZE).forEach(item => writeItem(batch, item));
              await withCloudTimeout(batch.commit(), 'Archive upload');
              reportProgress('Uploading archive', Math.min(i + CLOUD_BATCH_SIZE, items.length), items.length);
          }
      };
      let manuscriptDocs = [];
      sourceLibrary.forEach(item => {
          const id = item.id || makeId('ms');
          const { meta, chunks } = splitManuscriptForCloud({ ...item, id });
          manuscriptDocs.push({ id, data: meta });
          chunks.forEach(chunk => manuscriptDocs.push({ id: chunk.id, data: chunk }));
      });
      await commitChunks(manuscriptDocs, (batch, item) => batch.set(doc(msRef, item.id), item.data));
      await commitChunks(sourceCards, (batch, item) => batch.set(doc(vocabRef, item.id || makeId('card')), item));
      await commitChunks(Object.entries(sourceUserDict), (batch, [term, data]) => batch.set(doc(dictRef, term.replace(/\//g, '_')), data));
      await commitChunks(sourceActivityData, (batch, item) => batch.set(doc(activityRef, item.date || makeId('activity')), item));
      await withCloudTimeout(setDoc(appStateRef, sourceAppState, { merge: true }), 'Archive state upload');
  };

  const pushLocalDataToCloud = async () => {
      if (!user) {
          setSyncStatus("Cloud is not active in this run. Paste Firebase config and reload with the Firebase-enabled build first.");
          return;
      }
      setIsProcessing(true);
      setSyncStatus("Pushing local state to cloud...");
      try {
          await writeArchiveToCloud(preservedLocalArchiveRef.current || {});
          setSyncStatus("Cloud push complete. Texts, cards, annotations, glossary, and review state will live-sync.");
      } catch (err) {
          console.error("Cloud push failed:", err);
          setSyncStatus("Cloud push failed. Check the Firebase config and Firestore rules.");
      } finally {
          setIsProcessing(false);
      }
  };

  const runCloudDiagnostic = async () => {
      setIsProcessing(true);
      setSyncStatus("Testing Firebase write access...");
      try {
          await verifyCloudWritable('Manual cloud diagnostic');
          setSyncStatus(`Cloud diagnostic passed. Archive: ${cloudArchiveId}. UID: ${user.uid}.`);
      } catch (err) {
          console.error("Cloud diagnostic failed:", err);
          setSyncStatus(err.message || "Cloud diagnostic failed.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    try {
      const card = {...newCard, tags: String(newCard.tags || '').split(',').map(t => t.trim()).filter(Boolean), ...createStats()};
      if (user) await addDoc(collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary'), card);
      else setCards(prev => [{ ...card, id: makeId('card') }, ...prev]);
      setNewCard({ hanzi: '', pinyin: '', meaning: '', notes: '', category: 'Harvested Text', tags: '', example: '', example_meaning: '', distractors: '', nuance_tip: '', register: '', definition_cn: '' });
      setShowAddCardModal(false);
    } catch (err) { console.error("Error adding:", err); }
  };

  const saveEditedCard = async () => {
      if (!editingCard) return;
      const cleanCard = {
          ...editingCard,
          tags: Array.isArray(editingCard.tags) ? editingCard.tags : String(editingCard.tags || '').split(',').map(t => t.trim()).filter(Boolean)
      };
      if (!user) {
          setCards(prev => prev.map(card => card.id === cleanCard.id ? cleanCard : card));
          setEditingCard(null);
          return;
      }
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary', cleanCard.id), cleanCard);
          setEditingCard(null);
      } catch (err) {
          console.error("Card edit failed:", err);
          alert("Card edit failed.");
      }
  };

  const mergeDuplicateGroup = (term) => {
      const group = cards.filter(card => card.hanzi === term);
      if (group.length < 2) return;
      const [primary, ...rest] = group;
      const merged = rest.reduce((acc, card) => ({
          ...acc,
          pinyin: acc.pinyin || card.pinyin,
          meaning: acc.meaning || card.meaning,
          notes: [acc.notes, card.notes].filter(Boolean).join(' | '),
          example: acc.example || card.example,
          example_meaning: acc.example_meaning || card.example_meaning,
          distractors: acc.distractors || card.distractors,
          nuance_tip: acc.nuance_tip || card.nuance_tip,
          register: acc.register || card.register,
          definition_cn: acc.definition_cn || card.definition_cn,
          tags: [...new Set([...(acc.tags || []), ...(card.tags || [])])],
          streak: Math.max(acc.streak || 0, card.streak || 0),
          ease: Math.max(acc.ease || 2.5, card.ease || 2.5),
          interval: Math.max(acc.interval || 0, card.interval || 0),
          dueDate: [acc.dueDate, card.dueDate].filter(Boolean).sort()[0] || todayKey()
      }), primary);
      setCards(prev => [merged, ...prev.filter(card => card.hanzi !== term)]);
  };

  const saveSegmentationDraft = () => {
      if (!selection?.segmentId) return;
      const parts = segmentationDraft.split(/\s+/).map(item => item.trim()).filter(Boolean);
      setSegmentationOverrides(prev => ({ ...prev, [selection.segmentId]: parts }));
  };

  const saveAnnotationDraft = () => {
      if (!selection?.segmentId) return;
      setSegmentAnnotations(prev => ({ ...prev, [selection.segmentId]: annotationDraft }));
  };

  const handleClearDatabase = async () => {
    if (!window.confirm("WARNING: Deletes ALL PAIN cards. Cannot undo.")) return;
    setIsProcessing(true);
    if (!user) {
        setCards([]);
        setIsProcessing(false);
        return;
    }
    try {
        const snapshot = await getDocs(collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary'));
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit(); setCards([]); 
    } catch (err) { console.error(err); } finally { setIsProcessing(false); }
  };

  const handlePainImportData = async () => {
    setPainImportError(''); setIsProcessing(true);
    try {
      const parsedData = painImportAnalysis?.valid || [];
      if (!Array.isArray(parsedData) || parsedData.length === 0) throw new Error("No valid data found.");
      reportProgress('Preparing PAIN import', 0, parsedData.length, 'pain-import');
      const localReadyData = parsedData.map(item => ({ ...createStats(), ...item, id: item.id || makeId('card') }));
      setCards(prev => [...localReadyData, ...prev]);

      if (!user) {
          reportProgress('PAIN cards stored locally', parsedData.length, parsedData.length, 'pain-import');
          clearProgressSoon(`Stored ${parsedData.length} PAIN cards locally.`);
          setPainImportInput(''); setShowPainImportModal(false);
          return;
      }
      await verifyCloudWritable('PAIN card cloud write test');
      
      const collRef = collection(db, 'artifacts', appId, 'users', cloudArchiveId, 'vocabulary');
      let batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;
      let committed = 0;

      for (const item of localReadyData) {
          if (item.hanzi && item.meaning) {
              currentBatch.set(doc(collRef, item.id), item);
              opCount++;
              if (opCount === CLOUD_BATCH_SIZE) { batches.push({ batch: currentBatch, itemCount: opCount }); currentBatch = writeBatch(db); opCount = 0; }
          }
      }
      if (opCount > 0) batches.push({ batch: currentBatch, itemCount: opCount });
      for (const { batch, itemCount } of batches) {
          reportProgress('Uploading PAIN cards', committed, parsedData.length, 'pain-import');
          await withCloudTimeout(batch.commit(), 'PAIN card upload');
          committed = Math.min(parsedData.length, committed + itemCount);
          reportProgress('Uploading PAIN cards', committed, parsedData.length, 'pain-import');
      }
      clearProgressSoon(`Uploaded ${parsedData.length} PAIN cards.`);

      setPainImportInput(''); setShowPainImportModal(false);
    } catch (e) {
      console.error("PAIN import failed:", e);
      setPainImportError(`Cloud upload failed: ${e.message || 'unknown error'}. Parsed cards were kept on this device; check Firebase rules/config, then try Push Local Archive.`);
      setSyncStatus(`PAIN import failed: ${e.message || 'unknown error'}`);
    } finally { setIsProcessing(false); }
  };

  const handleExportBackup = () => {
      const payload = {
          exported_at: new Date().toISOString(),
          library,
          cards,
          userDict,
          activityData,
          conversionCodex,
          recentHarvests,
          segmentationOverrides,
          segmentAnnotations
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `occult-sinologist-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleBackupRestore = (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const payload = JSON.parse(e.target.result);
              if (!payload || (!Array.isArray(payload.library) && !Array.isArray(payload.cards))) throw new Error("Invalid backup");
              if (!window.confirm("Restore this backup? Current local state will be replaced.")) return;
              setIsProcessing(true);
              setLibrary(payload.library?.length ? payload.library : [DEMO_MANUSCRIPT]);
              setCards(payload.cards || []);
              setUserDict(payload.userDict || {});
              setActivityData(payload.activityData || []);
              setConversionCodex(payload.conversionCodex || {});
              setRecentHarvests(payload.recentHarvests || []);
              setSegmentationOverrides(payload.segmentationOverrides || {});
              setSegmentAnnotations(payload.segmentAnnotations || {});
              setActiveManuscriptId(null);
              setCurrentCardIndex(0);
              if (user) {
                  setSyncStatus("Restoring backup to cloud...");
                  await writeArchiveToCloud(payload);
                  setSyncStatus("Backup restored to cloud. Other devices will live-sync.");
              }
          } catch (err) {
              alert("Backup restore failed. The file does not look like an app backup.");
          } finally {
              setIsProcessing(false);
              if (backupInputRef.current) backupInputRef.current.value = null;
          }
      };
      reader.readAsText(file);
  };

  // --- CONTINUOUS KEYBOARD TRIGGERS (Bypassing OS Debounce) ---
  const keyboardStateRef = useRef({});
  useEffect(() => {
      keyboardStateRef.current = {
          currentAppView, showAddCardModal, showPainImportModal, activePainCard, isDrillMode, 
          isReverse, isFlipped, isMcq, handleDrillAction, handlePainPrev, handlePainNext, 
          handleSpeak, nuanceFeedback, mcqFeedback, handleMcqSelect, skipActiveCard, continueAfterMcq,
          markActiveCardKnown, setIsFlipped, showStatsModal, showManualModal
      };
  });

  useEffect(() => {
      const intervals = {};
      
      const triggerContinuous = (code) => {
          const state = keyboardStateRef.current;
          if (state.currentAppView !== 'pain' || state.showAddCardModal || state.showPainImportModal || state.nuanceFeedback || state.mcqFeedback || state.showStatsModal || state.showManualModal) return;
          if (!state.activePainCard) return;
          
          if (code === 'KeyW') { if (state.isDrillMode) state.handleDrillAction('again'); else state.handlePainNext('incorrect'); }
          if (code === 'KeyR') { if (state.isDrillMode) state.handleDrillAction('right'); else state.handlePainNext('correct'); }
      };

      const handleKeyDown = (e) => {
          const state = keyboardStateRef.current;
          if (state.currentAppView !== 'pain') return;
          if (state.showAddCardModal || state.showPainImportModal || state.nuanceFeedback || state.showStatsModal || state.showManualModal) return;
          if (state.mcqFeedback) {
              if (['Enter', 'Space', 'ArrowRight', 'KeyD'].includes(e.code)) {
                  e.preventDefault();
                  state.continueAfterMcq(e);
              } else if (e.code === 'KeyE') {
                  e.preventDefault();
                  state.markActiveCardKnown(e);
              } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                  e.preventDefault();
                  state.skipActiveCard(e);
              }
              return;
          }
          if (!state.activePainCard && !state.isDrillMode) return;

          // Trap continuous triggers (W & R)
          if (e.code === 'KeyW' || e.code === 'KeyR') {
              if (e.repeat) return; // Ignore OS native repeat
              e.preventDefault(); // Stop unwanted browser interactions
              isRapidFiringRef.current = true;
              if (!intervals[e.code]) {
                  triggerContinuous(e.code); // Fire immediate
                  intervals[e.code] = setInterval(() => triggerContinuous(e.code), 180); // Fire unthrottled
              }
              return;
          }

          // Single Action Triggers
          if (state.isMcq && state.activePainCard?._options) {
               let idx = -1;
               if (e.code === 'KeyZ') idx = 0; else if (e.code === 'KeyX') idx = 1; else if (e.code === 'KeyC') idx = 2; else if (e.code === 'KeyV') idx = 3;
               if (idx >= 0 && state.activePainCard._options[idx]) { state.handleMcqSelect(state.activePainCard._options[idx]); return; }
          }

          switch(e.code) {
              case 'Space': case 'KeyF':
                  if (!state.isMcq) { e.preventDefault(); state.setIsFlipped(prev => !prev); }
                  break;
              case 'KeyS':
                  if (state.activePainCard) {
                       if (state.isMcq && state.activePainCard._mode === 'zh-en') state.handleSpeak(state.activePainCard.hanzi);
                       else if (state.activePainCard._type === 'mcq-cloze') state.handleSpeak(state.activePainCard.example);
                       else if (state.isDrillMode && state.isReverse && !state.isFlipped) { if (state.activePainCard.example) state.handleSpeak(state.activePainCard.example); }
                       else state.handleSpeak(state.activePainCard.hanzi);
                  }
                  break;
              case 'ArrowLeft': case 'KeyA': if (state.isDrillMode) state.handleDrillAction('again'); else state.handlePainPrev(); break;
              case 'ArrowRight': case 'KeyD': state.skipActiveCard(e); break;
              case 'KeyE': state.markActiveCardKnown(e); break; 
              default: break;
          }
      };

      const handleKeyUp = (e) => {
          if (intervals[e.code]) {
              clearInterval(intervals[e.code]);
              delete intervals[e.code];
          }
          if (Object.keys(intervals).length === 0) {
              isRapidFiringRef.current = false;
          }
      };

      const clearAllIntervals = () => {
          Object.values(intervals).forEach(clearInterval);
          for (let key in intervals) delete intervals[key];
          isRapidFiringRef.current = false;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('blur', clearAllIntervals); // Safety catch
      
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
          window.removeEventListener('blur', clearAllIntervals);
          clearAllIntervals();
      };
  }, []); 

  const getCategoryColor = (cat) => {
    if (cat === 'Political Science') return 'bg-rose-900/40 text-rose-200 border-rose-800';
    if (cat === 'Literature' || cat === 'Lit') return 'bg-amber-900/40 text-amber-200 border-amber-800';
    return 'bg-neutral-800 text-neutral-300 border-neutral-700';
  };

  // --- RENDER HELPERS (READER) ---
  const renderInteractiveText = (scText, segmentId) => {
    let segments = segmentationOverrides[segmentId] || (typeof Intl !== 'undefined' && 'Segmenter' in Intl ? Array.from(new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(scText)).map(s => s.segment) : scText.split(''));
    return (
        <span onMouseUp={() => handleTextMouseUp(segmentId)} className="inline-block font-cn">
            {segments.map((seg, idx) => {
                const isKnown = !!userDict[seg] || !!MOCK_DICT[seg];
                const painCard = cards.find(c => c.hanzi === seg);
                
                let dynamicStyle = { className: 'text-stone-500 hover:text-stone-300 transition-colors', style: {} }; 
                
                if (painCard) {
                    dynamicStyle = getStreakStyle(painCard.streak || 0);
                } else if (isKnown) {
                    dynamicStyle = { className: 'text-stone-200 hover:text-rose-400 font-normal transition-colors', style: {} }; 
                }

                // Trinitarian Masking
                const displaySeg = script === 'TC' ? contextConvert(seg) : seg;

                return (
                    <span key={idx} onClick={() => handleCharClick(seg, segmentId)} className={`cursor-pointer inline-block selection:bg-rose-900 selection:text-white font-cn ${dynamicStyle.className}`} style={dynamicStyle.style}>
                        {displaySeg}
                    </span>
                )
            })}
        </span>
    );
  };

  // --- DYNAMIC PAIN EFFECTS ---
  let activeEffect = { text: null, bgClass: '' };
  let cardStyle = { style: {}, className: '' };

  if (activePainCard) {
      const streak = activePainCard.streak || 0;
      activeEffect = getStreakWatermark(streak);
      cardStyle = getStreakStyle(streak);
  }

  return (
    <div className={`min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-950 via-zinc-950 to-black font-body text-stone-300 flex flex-col overflow-x-hidden w-full max-w-full`}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=IM+Fell+English:ital@0;1&display=swap');
        
        body, .font-tech, .font-mono, input, textarea, select, button { font-family: 'EB Garamond', serif; }
        .font-heading, .font-gothic { font-family: 'IM Fell English', serif; }
        .font-body, .font-serif-main { font-family: 'EB Garamond', serif; }
        .font-cn { font-family: 'Kaiti TC', 'BiauKai', 'DFKai-SB', 'Kaiti', 'KaiTi', 'STKaiti', serif; }
        
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #09090b; }
        ::-webkit-scrollbar-thumb { background: #292524; border: 1px solid #09090b; }
        ::-webkit-scrollbar-thumb:hover { background: #881337; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #44403c; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e11d48; }
        
        .coffin-btn { clip-path: polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%); }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        @keyframes bloody-glow { 0%, 100% { text-shadow: 0 0 10px #ef4444, 0 0 20px #991b1b, 0 0 40px #7f1d1d; color: #fca5a5; } 50% { text-shadow: 0 0 20px #dc2626, 0 0 40px #991b1b, 0 0 60px #7f1d1d; color: #f87171; } }
        @keyframes divine-glow { 0%, 100% { text-shadow: 0 0 10px #10b981, 0 0 20px #065f46, 0 0 40px #064e3b; color: #6ee7b7; } 50% { text-shadow: 0 0 20px #34d399, 0 0 40px #065f46, 0 0 60px #064e3b; color: #a7f3d0; } }
        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } }
      `}</style>

      {importProgress && !showPainImportModal && (
        <div className="fixed left-3 right-3 bottom-3 z-50 border border-rose-900/50 bg-black/95 backdrop-blur-md rounded-sm shadow-2xl p-3 md:left-auto md:w-96">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
              <span className="text-xs md:text-sm text-stone-200 uppercase tracking-widest truncate">{importProgress.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] md:text-xs text-stone-400 whitespace-nowrap">
                {importProgress.total ? `${importProgress.current} / ${importProgress.total}` : 'Working'}
              </span>
              <button onClick={() => setImportProgress(null)} className="text-stone-600 hover:text-stone-300 p-1" title="Hide progress"><X className="w-3 h-3" /></button>
            </div>
          </div>
          {importProgress.total > 0 && (
            <div className="h-2 bg-stone-900 border border-stone-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-rose-700 transition-all"
                style={{ width: `${Math.max(4, Math.min(100, Math.round((importProgress.current / importProgress.total) * 100)))}%` }}
              />
            </div>
          )}
          {syncStatus && <p className="text-[10px] md:text-xs text-stone-500 mt-2 break-words">{syncStatus}</p>}
        </div>
      )}

      <div className="flex-1 flex flex-col w-full max-w-full relative z-10">
          {/* --- UNIFIED HEADER --- */}
          <header className="border-b border-stone-800 bg-black/60 backdrop-blur-md p-4 flex flex-wrap gap-4 justify-between items-center shadow-2xl relative z-40 w-full max-w-full">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="relative group cursor-pointer" onClick={() => setActiveManuscriptId(null)}>
                <Skull className="text-rose-800 w-8 h-8 group-hover:text-rose-600 group-hover:animate-pulse transition-colors duration-500" />
                <div className="absolute inset-0 bg-rose-600 blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
              </div>
              
              {/* HEMISPHERE SWITCHER */}
              <div className="flex bg-stone-900 rounded-sm p-1 border border-stone-800 overflow-x-auto max-w-full">
                 <button 
                    onClick={() => setCurrentAppView('reader')}
                    className={`px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-body uppercase tracking-widest transition-colors rounded-sm flex items-center gap-2 whitespace-nowrap ${currentAppView === 'reader' ? 'bg-stone-800 text-rose-400 shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                 >
                    <Scroll className="w-3 h-3"/> Athenaeum
                 </button>
                 <button 
                    onClick={() => setCurrentAppView('pain')}
                    className={`px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-body uppercase tracking-widest transition-colors rounded-sm flex items-center gap-2 whitespace-nowrap ${currentAppView === 'pain' ? 'bg-stone-800 text-rose-400 shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                 >
                    <BrainCircuit className="w-3 h-3"/> PAIN Engine
                 </button>
              </div>
            </div>

            <div className="flex items-center gap-3 md:gap-4 flex-wrap justify-end">
              <div className="text-[10px] md:text-xs text-stone-500 font-body uppercase tracking-[0.2em] flex items-center gap-2 mr-0 md:mr-4 hidden sm:flex">
                 {currentAppView === 'reader' ? 'Extraction' : 'Systematic Torture'}
                 <span className={`w-1.5 h-1.5 ${user ? 'bg-emerald-700' : 'bg-amber-700'} rounded-full inline-block shadow-[0_0_5px_rgba(4,120,87,0.8)]`} title={user ? "Cloud sync active" : "Local archive mode"}></span>
                 <span className="text-stone-600">{user ? 'Cloud' : 'Local'}</span>
              </div>

              <button onClick={() => setShowManualModal(true)} className="w-6 h-6 md:w-8 md:h-8 border border-stone-800 bg-zinc-950/80 rounded-sm flex items-center justify-center hover:border-rose-800 hover:text-rose-600 transition-all relative group overflow-hidden shrink-0" title="Codex of Operations"><Info className="w-4 h-4" /></button>
              <input type="file" ref={backupInputRef} onChange={handleBackupRestore} className="hidden" accept=".json" />
              <button onClick={handleExportBackup} className="w-6 h-6 md:w-8 md:h-8 border border-stone-800 bg-zinc-950/80 rounded-sm flex items-center justify-center hover:border-emerald-900 hover:text-emerald-400 transition-all shrink-0" title="Export full backup"><Save className="w-4 h-4" /></button>
              <button onClick={() => backupInputRef.current?.click()} className="w-6 h-6 md:w-8 md:h-8 border border-stone-800 bg-zinc-950/80 rounded-sm flex items-center justify-center hover:border-rose-800 hover:text-rose-500 transition-all shrink-0" title="Restore backup"><RotateCcw className="w-4 h-4" /></button>
              <button onClick={toggleScript} className="w-6 h-6 md:w-8 md:h-8 border border-stone-800 bg-zinc-950/80 rounded-sm flex items-center justify-center hover:border-rose-800 hover:text-rose-600 transition-all relative group overflow-hidden shrink-0"><span className="font-cn font-bold z-10 text-xs md:text-sm">{script === 'SC' ? '简' : '繁'}</span></button>

              {currentAppView === 'reader' && activeManuscriptId && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button onClick={harvestUnknownWords} className="flex items-center gap-1 md:gap-2 px-3 py-1 border border-stone-800 rounded-sm font-body text-[10px] uppercase tracking-widest transition-all bg-rose-950/20 text-rose-400 hover:bg-rose-900/40 hover:border-rose-800 shadow-[0_0_10px_rgba(225,29,72,0.1)]" title="Extract OOV Elements"><Ghost className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden sm:inline">Harvest OOV</span></button>
                    <button onClick={() => { setShowSentenceStudy(true); setSentenceIndex(0); setSentenceFlipped(false); }} className="flex items-center gap-1 md:gap-2 px-3 py-1 border border-stone-800 rounded-sm font-body text-[10px] uppercase tracking-widest transition-all bg-black/40 text-stone-400 hover:text-rose-400 hover:border-rose-800" title="Sentence Study"><BookOpen className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden sm:inline">Sentences</span></button>
                    <button onClick={() => setMode(prev => prev === 'bilingual' ? 'monolingual' : 'bilingual')} className="flex items-center gap-2 group cursor-pointer select-none">
                        <span className={`text-[10px] uppercase tracking-widest transition-colors font-body hidden sm:inline ${mode === 'monolingual' ? 'text-rose-600 font-bold shadow-rose-900' : 'text-stone-600'}`}>Mono</span>
                        <div className="relative w-8 md:w-10 h-4 md:h-5 bg-stone-900 border border-stone-800 rounded-full p-0.5 md:p-1 transition-colors group-hover:border-rose-900"><div className={`w-3 h-3 rounded-full bg-stone-300 shadow-md transform transition-transform duration-300 ${mode === 'bilingual' ? 'translate-x-4 md:translate-x-5 bg-rose-800' : 'translate-x-0'}`}></div></div>
                        <span className={`text-[10px] uppercase tracking-widest transition-colors font-body hidden sm:inline ${mode === 'bilingual' ? 'text-rose-600 font-bold' : 'text-stone-600'}`}>Dual</span>
                    </button>
                </div>
              )}

              {currentAppView === 'reader' && (
                 <>
                   <div className="h-6 w-px bg-stone-800 mx-1 md:mx-2 hidden sm:block"></div>
                   <input type="file" ref={fileInputRef} onChange={handleReaderFileUpload} className="hidden" accept=".json,.txt" />
                   <button onClick={() => setShowStatsModal(true)} className="flex items-center gap-1 md:gap-2 px-3 py-1 border border-stone-800 rounded-sm font-body text-[10px] uppercase tracking-widest transition-all bg-zinc-950/50 text-stone-400 hover:bg-stone-900 hover:text-stone-200" title="Analytics"><Activity className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden sm:inline">Analytics</span></button>
                   <button onClick={() => setShowLexiconModal(true)} className="text-stone-500 hover:text-rose-500 transition-colors flex items-center gap-1" title="Lexicon Manager"><Library className="w-4 h-4" /><span className="text-[10px] font-body uppercase hidden md:inline">Glossary</span></button>
                   <button onClick={() => setShowPasteModal(true)} className="text-stone-500 hover:text-rose-500 transition-colors" title="Scribe Manuscript"><Plus className="w-4 h-4" /></button>
                 </>
              )}

              {currentAppView === 'pain' && (
                 <>
                   <button onClick={() => setShowStatsModal(true)} className="flex items-center gap-1 md:gap-2 px-3 py-1 border border-stone-800 rounded-sm font-body text-[10px] uppercase tracking-widest transition-all bg-zinc-950/50 text-stone-400 hover:bg-stone-900 hover:text-stone-200" title="Analytics"><Activity className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden sm:inline">Analytics</span></button>
                   <button onClick={() => exportToTSV(cards, 'PAIN_Engine_Vocabulary.tsv')} className="text-stone-500 hover:text-emerald-400 transition-colors flex items-center gap-1" title="Export PAIN Vocabulary"><Download className="w-4 h-4" /><span className="text-[10px] font-body uppercase hidden md:inline">Export TSV</span></button>
                  <button onClick={openPainImportModal} className="text-stone-500 hover:text-rose-500 transition-colors flex items-center gap-1" title="Bulk Import"><FileSpreadsheet className="w-4 h-4" /><span className="text-[10px] font-body uppercase hidden md:inline">Import</span></button>
                   <button onClick={() => setShowDataAudit(true)} className="text-stone-500 hover:text-rose-500 transition-colors flex items-center gap-1" title="Data Quality Audit"><AlertCircle className="w-4 h-4" /><span className="text-[10px] font-body uppercase hidden md:inline">Audit</span></button>
                   <button onClick={() => setShowRelationGraph(true)} className="text-stone-500 hover:text-rose-500 transition-colors flex items-center gap-1" title="Relationship Graph"><Network className="w-4 h-4" /><span className="text-[10px] font-body uppercase hidden md:inline">Graph</span></button>
                   <button onClick={() => setShowSyncSettings(true)} className="text-stone-500 hover:text-rose-500 transition-colors flex items-center gap-1" title="Sync Settings"><Database className="w-4 h-4" /><span className="text-[10px] font-body uppercase hidden md:inline">Sync</span></button>
                   <button onClick={() => setShowAddCardModal(true)} className="text-stone-500 hover:text-rose-500 transition-colors flex items-center gap-1" title="Add Card" aria-label="Add Card"><Plus className="w-4 h-4" /><span className="text-[10px] font-body uppercase hidden md:inline">Add Card</span></button>
                 </>
              )}
            </div>
          </header>

          {/* ========================================================= */}
          {/* ================= HEMISPHERE L: READER ==================== */}
          {/* ========================================================= */}
          {currentAppView === 'reader' && (
            <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 relative w-full max-w-full">
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vmin] h-[150vmin] max-w-[800px] max-h-[800px] pointer-events-none opacity-10 md:opacity-20 z-0">
                  <div className="w-full h-full border border-stone-800/30 rounded-full absolute animate-[spin_60s_linear_infinite]"></div>
                  <div className="w-[75%] h-[75%] border border-rose-900/10 rotate-45 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
              </div>

              {!activeManuscriptId && (
                  <div className="relative z-10 max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-500 w-full">
                      {showOnboarding && (
                          <div className="mb-6 border border-rose-900/50 bg-black/50 p-4 md:p-6 rounded-sm shadow-2xl">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div>
                                      <div className="text-[10px] uppercase tracking-widest text-rose-500 font-body mb-2">First-run path</div>
                                      <h3 className="font-heading text-2xl text-stone-100 italic mb-2">Build the loop: import, harvest, drill.</h3>
                                      <p className="text-sm text-stone-500 font-body italic">Start with a text, upload a glossary if you have one, harvest unknown terms, then send them into the PAIN Engine.</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2 shrink-0">
                                      <button onClick={() => setShowPasteModal(true)} className="px-4 py-2 bg-rose-900/40 border border-rose-900 text-rose-200 text-[10px] uppercase tracking-widest rounded-sm">Import Text</button>
                                      <button onClick={() => setShowLexiconModal(true)} className="px-4 py-2 bg-stone-900 border border-stone-700 text-stone-300 text-[10px] uppercase tracking-widest rounded-sm">Glossary</button>
                                      <button onClick={() => { localStorage.setItem(`${LOCAL_STORE_KEY}-onboarded`, 'true'); setShowOnboarding(false); }} className="px-4 py-2 text-stone-500 text-[10px] uppercase tracking-widest rounded-sm">Dismiss</button>
                                  </div>
                              </div>
                          </div>
                      )}
                      <div className="text-center mb-10 md:mb-16 mt-4 md:mt-8 px-2">
                          <h2 className="font-heading text-4xl md:text-6xl text-stone-100 mb-2 md:mb-4 drop-shadow-xl font-bold italic">The Athenaeum</h2>
                          <p className="text-stone-500 font-body italic text-sm md:text-lg">Corpus alignment and semantic extraction.</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                          {[
                              ['Texts', dashboard.manuscripts],
                              ['Glossary', dashboard.glossary],
                              ['Cards', dashboard.cards],
                              ['Weak Terms', dashboard.weak]
                          ].map(([label, value]) => (
                              <div key={label} className="border border-stone-800 bg-black/40 p-3 rounded-sm">
                                  <div className="text-[9px] uppercase tracking-widest text-stone-600 font-body">{label}</div>
                                  <div className="text-2xl text-stone-100 font-heading italic">{value}</div>
                              </div>
                          ))}
                      </div>
                      {recentHarvests.length > 0 && (
                          <div className="mb-8 border border-rose-900/30 bg-rose-950/20 p-4 rounded-sm">
                              <div className="flex items-center justify-between mb-3">
                                  <div className="text-[10px] uppercase tracking-widest text-rose-500 font-body flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Recently Harvested</div>
                                  <button onClick={() => setCurrentAppView('pain')} className="text-[10px] uppercase tracking-widest text-stone-500 hover:text-rose-400">Review in PAIN</button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  {recentHarvests.map(item => <span key={item.term} className="px-2 py-1 border border-stone-800 bg-black/40 rounded-sm text-sm font-cn text-stone-300">{item.term}</span>)}
                              </div>
                          </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full">
                          {library.map(manuscript => (
                              <div key={manuscript.id} onClick={() => setActiveManuscriptId(manuscript.id)} className="group bg-zinc-950/50 border border-stone-800 p-6 md:p-8 hover:border-rose-900 hover:bg-black/80 transition-all cursor-pointer relative overflow-hidden shadow-lg hover:shadow-rose-900/20 w-full break-words">
                                  <div className="absolute top-0 left-0 w-full h-1 bg-stone-800 group-hover:bg-rose-800 transition-colors"></div>
                                  <div className="absolute top-4 right-4 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20"><button onClick={(e) => deleteManuscript(manuscript.id, e)} className="text-stone-600 hover:text-rose-600 p-2"><Trash2 className="w-4 h-4"/></button></div>
                                  <div className="flex justify-between items-start mb-4 pr-8"><span className="px-2 py-1 bg-stone-900/50 text-stone-400 border border-stone-800 rounded-sm text-[10px] uppercase tracking-widest font-body group-hover:text-rose-400 max-w-[60%] truncate">{manuscript.category}</span><span className="text-[10px] font-body text-stone-600 shrink-0">{new Date(manuscript.date).toLocaleDateString()}</span></div>
                                  <h3 className="font-heading text-xl md:text-2xl text-stone-200 mb-2 group-hover:text-rose-500 transition-colors line-clamp-2">{manuscript.title}</h3>
                                  <div className="h-px w-12 bg-stone-800 my-4 group-hover:w-full transition-all duration-700"></div>
                                  <p className="font-cn text-stone-500 text-xs md:text-sm line-clamp-3 leading-relaxed group-hover:text-stone-400 break-words">{manuscript.content[0]?.sc || "No content preview."}</p>
                              </div>
                          ))}
                          <div onClick={() => setShowPasteModal(true)} className="border border-dashed border-stone-800 bg-zinc-950/20 p-6 md:p-8 flex flex-col items-center justify-center gap-4 text-stone-600 hover:text-stone-300 hover:border-stone-500 transition-all cursor-pointer min-h-[200px] md:min-h-[250px] w-full">
                              <Plus className="w-8 h-8 opacity-50" /><span className="font-body text-[10px] md:text-xs uppercase tracking-widest text-center">Inscribe New Text</span>
                          </div>
                      </div>
                  </div>
              )}

              {activeManuscript && (
                  <div className="relative z-10 max-w-7xl mx-auto transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 w-full">
                      <div className="mb-8 md:mb-12 text-center border-b border-stone-800 pb-6 md:pb-8 mt-4 md:mt-8 relative px-4">
                          <button onClick={() => setActiveManuscriptId(null)} className="absolute left-0 top-0 md:top-2 flex items-center gap-1 md:gap-2 text-stone-500 hover:text-rose-500 font-body text-[10px] md:text-xs uppercase tracking-widest"><ChevronLeft className="w-4 h-4"/> Back</button>
                          <h2 className="font-heading text-3xl md:text-5xl mb-2 md:mb-4 text-stone-100 drop-shadow-xl font-semibold break-words mt-8 md:mt-0">{activeManuscript.title}</h2>
                          <div className="flex justify-center items-center gap-2 md:gap-4 text-[10px] md:text-xs tracking-widest font-body flex-wrap">
                          <span className="px-2 py-1 bg-amber-900/40 text-amber-200 border border-amber-900/50 rounded-sm flex items-center gap-2"><Scroll className="w-3 h-3 hidden sm:block" /> {activeManuscript.category}</span>
                          <span className="text-stone-600">•</span><span className="text-stone-400 font-body">Imported: {new Date(activeManuscript.date).toLocaleDateString()}</span>
                          </div>
                      </div>

                      <div className="space-y-8 md:space-y-10 w-full">
                          {data.map((segment) => (
                          <div key={segment.id} className={`group relative transition-all duration-500 ${mode === 'bilingual' ? 'flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-12 items-baseline border-b border-stone-900 pb-8 md:pb-10 hover:border-rose-900/50 w-full' : 'flex flex-col items-center gap-4 md:gap-6 pb-8 md:pb-12 w-full'}`}>
                              <div className={`${mode === 'monolingual' ? 'text-center w-full max-w-2xl' : 'text-left md:text-right w-full'} font-cn text-2xl md:text-3xl leading-loose tracking-wide text-stone-300 break-words`}>
                                  {renderInteractiveText(segment.sc, segment.id)}
                              </div>
                              {mode === 'bilingual' && ( <div className="font-body text-lg md:text-xl text-stone-500 leading-relaxed italic border-l-2 border-stone-800 pl-4 md:pl-10 h-full flex items-center min-h-0 md:min-h-[40px] break-words w-full">{segment.en}</div> )}
                              {segmentAnnotations[segment.id] && (
                                  <div className="md:col-span-2 text-xs text-stone-500 border border-stone-900 bg-black/30 p-3 rounded-sm italic">
                                      {segmentAnnotations[segment.id]}
                                  </div>
                              )}
                          </div>
                          ))}
                      </div>
                      <div className="mt-16 md:mt-24 text-center text-stone-600 font-heading text-base md:text-lg italic pb-16 md:pb-24 w-full"><p className="flex justify-center items-center gap-2"><Flame className="w-3 h-3 md:w-4 md:h-4 text-rose-900" /> End of Fragment <Flame className="w-3 h-3 md:w-4 md:h-4 text-rose-900" /></p></div>
                  </div>
              )}
            </main>
          )}


          {/* ========================================================= */}
          {/* ================= HEMISPHERE R: PAIN ====================== */}
          {/* ========================================================= */}
          {currentAppView === 'pain' && (
             <div
                className="flex-1 flex flex-col items-center p-4 md:p-8 overflow-x-hidden overflow-y-auto z-10 relative w-full max-w-full"
                style={{ paddingBottom: activePainCard ? 'calc(7rem + env(safe-area-inset-bottom))' : 'calc(2rem + env(safe-area-inset-bottom))' }}
             >
                {!activePainCard && (
                <header className="mb-4 md:mb-6 text-center max-w-2xl w-full mt-4 md:mt-0 px-2">
                    <div className="flex items-center justify-center gap-2 md:gap-3 mb-2"><Flame className={`w-6 h-6 md:w-8 md:h-8 ${isDrillMode ? 'text-rose-600 animate-pulse' : 'text-stone-500'}`} /><h1 className="text-3xl md:text-5xl font-heading tracking-widest text-stone-100 font-bold italic break-words">The PAIN Engine</h1></div>
                    <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-rose-800 font-bold mb-2 opacity-80 font-body">Pathological Acquisition of Intellectual Necrosis</div>
                </header>
                )}

                {!isDrillMode && !isReviewSession && (
                  <div className="w-full max-w-3xl mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 z-10 relative">
                    {[
                      ['Due Today', dashboard.due],
                      ['New', dashboard.newCards],
                      ['Weak', dashboard.weak],
                      ['Accuracy', `${dashboard.accuracy}%`]
                    ].map(([label, value]) => (
                      <div key={label} className="border border-stone-800 bg-black/40 p-3 rounded-sm text-center">
                        <div className="text-[9px] uppercase tracking-widest text-stone-600 font-body">{label}</div>
                        <div className="text-2xl text-stone-100 font-heading italic">{value}</div>
                      </div>
                    ))}
                    <div className="col-span-2 md:col-span-4 border border-stone-800 bg-black/40 p-3 rounded-sm">
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button onClick={() => { setPainMode('recurring'); setReviewMode('due'); setIsReviewSession(false); }} className={`px-3 py-2 border rounded-sm text-[10px] uppercase tracking-widest ${painMode === 'recurring' ? 'border-emerald-800 bg-emerald-950/25 text-emerald-300' : 'border-stone-800 bg-stone-950 text-stone-500'}`}>Recurring Pain</button>
                          <button onClick={() => setPainMode('struggle')} className={`px-3 py-2 border rounded-sm text-[10px] uppercase tracking-widest ${painMode === 'struggle' ? 'border-rose-800 bg-rose-950/25 text-rose-300' : 'border-stone-800 bg-stone-950 text-stone-500'}`}>Struggle Session</button>
                        </div>
                        {painMode === 'recurring' ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-widest text-stone-500">Review</span>
                                <select value={reviewMode} onChange={e => { setReviewMode(e.target.value); setCurrentCardIndex(0); }} className="bg-black/50 border border-stone-800 text-stone-300 px-2 py-1 rounded-sm text-sm">
                                  <option value="due">Due Today</option>
                                  <option value="all">All Active Cards</option>
                                </select>
                              </div>
                              <button onClick={() => setShowCardBrowser(true)} className="px-3 py-1 border border-stone-800 bg-stone-900 text-stone-300 rounded-sm text-[10px] uppercase tracking-widest">Browse Cards</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[
                                ['flash', 'Flash'],
                                ['mcq', 'MCQ'],
                                ['cloze', 'Cloze'],
                                ['nuance', 'Nuance'],
                                ['register', 'Register'],
                                ['mono', 'Mono']
                              ].map(([key, label]) => (
                                <label key={key} className={`px-2 py-1 border rounded-sm text-[10px] uppercase tracking-widest cursor-pointer ${drillConfig[key] ? 'border-emerald-900 text-emerald-400 bg-emerald-950/20' : 'border-stone-800 text-stone-600'}`}>
                                  <input type="checkbox" className="hidden" checked={drillConfig[key]} onChange={e => setDrillConfig(prev => ({ ...prev, [key]: e.target.checked }))} />
                                  {label}
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] uppercase tracking-widest text-stone-500">Target</span>
                              <input type="number" min="1" max="200" value={drillConfig.limit} onChange={e => setDrillConfig(prev => ({ ...prev, limit: e.target.value }))} className="w-16 bg-black/50 border border-stone-800 text-stone-300 px-2 py-1 rounded-sm text-sm" title="Card limit" />
                              <select value={drillConfig.scope} onChange={e => setDrillConfig(prev => ({ ...prev, scope: e.target.value }))} className="bg-black/50 border border-stone-800 text-stone-300 px-2 py-1 rounded-sm text-sm">
                                <option value="due">Due today</option>
                                <option value="weak">Weak</option>
                                <option value="difficult">Difficult</option>
                                <option value="new">New cards</option>
                                <option value="tag">By tag</option>
                                <option value="all">All active</option>
                              </select>
                              {drillConfig.scope === 'tag' && (
                                <select value={drillConfig.tag} onChange={e => setDrillConfig(prev => ({ ...prev, tag: e.target.value }))} className="bg-black/50 border border-stone-800 text-stone-300 px-2 py-1 rounded-sm text-sm max-w-[180px]">
                                  {cardTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                                </select>
                              )}
                              <button onClick={() => setShowCardBrowser(true)} className="px-3 py-1 border border-stone-800 bg-stone-900 text-stone-300 rounded-sm text-[10px] uppercase tracking-widest">Browse Cards</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[
                                ['flash', 'Flash'],
                                ['mcq', 'MCQ'],
                                ['cloze', 'Cloze'],
                                ['nuance', 'Nuance'],
                                ['register', 'Register'],
                                ['mono', 'Mono']
                              ].map(([key, label]) => (
                                <label key={key} className={`px-2 py-1 border rounded-sm text-[10px] uppercase tracking-widest cursor-pointer ${drillConfig[key] ? 'border-rose-900 text-rose-400 bg-rose-950/20' : 'border-stone-800 text-stone-600'}`}>
                                  <input type="checkbox" className="hidden" checked={drillConfig[key]} onChange={e => setDrillConfig(prev => ({ ...prev, [key]: e.target.checked }))} />
                                  {label}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className={`w-full max-w-lg mb-6 md:mb-8 flex flex-wrap gap-3 justify-between items-center p-3 md:p-4 rounded-sm shadow-2xl border transition-all z-10 relative ${isDrillMode ? 'bg-rose-950/20 border-rose-900/50' : 'bg-black/40 border-stone-800'}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                        {(painMode === 'struggle' || isDrillMode) && (
                          <button onClick={isDrillMode ? exitPainSession : startConfiguredDrillMode} disabled={calculateQueueSize() === 0 && !isDrillMode} className={`flex items-center gap-1 md:gap-2 px-4 md:px-6 py-2 text-[10px] md:text-xs font-bold font-body uppercase tracking-wider transition-all coffin-btn ${isDrillMode ? 'bg-rose-800 text-white hover:bg-rose-700' : 'bg-stone-800 text-stone-400 hover:bg-rose-900/50'}`}>
                              <Flame className={`w-3 h-3 hidden sm:block ${isDrillMode ? 'fill-current' : ''}`} />{isDrillMode ? `Stop Struggle` : `Start Struggle (${calculateQueueSize()})`}
                          </button>
                        )}
                        {(painMode === 'recurring' || isReviewSession) && !isDrillMode && (
                          <button onClick={isReviewSession ? exitPainSession : startRecurringPain} disabled={(recurringPromptCount === 0 && !isReviewSession) || isStartingReview} className={`flex items-center gap-1 md:gap-2 px-4 md:px-6 py-2 text-[10px] md:text-xs font-bold font-body uppercase tracking-wider transition-all coffin-btn ${isReviewSession ? 'bg-emerald-800 text-white hover:bg-emerald-700' : 'bg-stone-800 text-stone-400 hover:bg-emerald-900/50'} disabled:opacity-60`}>
                              <RefreshCw className={`w-3 h-3 hidden sm:block ${isStartingReview ? 'animate-spin' : ''}`} />{isReviewSession ? `Stop Recurring` : isStartingReview ? 'Starting...' : `Start Recurring (${recurringPromptCount})`}
                          </button>
                        )}
                        <button onClick={() => setAutoPlayAudio(!autoPlayAudio)} className={`flex items-center gap-1.5 px-2 md:px-4 py-2 transition-all ${autoPlayAudio ? 'text-rose-400' : 'text-stone-600'}`} title="Auto-Audio">{autoPlayAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button>
                    </div>
                    {!isDrillMode && !isReviewSession && (
                        <>
                        <div className="flex flex-wrap gap-2 w-full">
                            <select value={voiceSettings.voiceURI} onChange={e => setVoiceSettings(prev => ({ ...prev, voiceURI: e.target.value }))} className="bg-black/50 border border-stone-800 text-stone-400 px-2 py-1 rounded-sm text-[10px] max-w-[220px]">
                                <option value="">System Chinese Voice</option>
                                {availableVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
                            </select>
                            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-500">
                                Rate
                                <input type="range" min="0.5" max="1.2" step="0.05" value={voiceSettings.rate} onChange={e => setVoiceSettings(prev => ({ ...prev, rate: e.target.value }))} />
                            </label>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                            <Filter className="w-3 h-3 text-stone-500 hidden sm:block" />
                            <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setCurrentCardIndex(0); setIsFlipped(false); }} className="bg-stone-900 sm:bg-transparent border border-stone-800 sm:border-none text-[10px] md:text-xs text-stone-400 focus:ring-0 cursor-pointer hover:text-rose-400 outline-none font-body tracking-wide uppercase p-1 sm:p-0 w-full sm:w-auto max-w-[150px] truncate">
                                <option value="All">All Categories</option>
                                {[...new Set(cards.map(c => c.category))].sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className="w-full text-center text-[9px] md:text-[10px] text-stone-600 mt-1 md:mt-2 font-body uppercase">{painMode === 'recurring' ? `Recurring Pain: ${recurringPromptCount} prompts from ${reviewCards.length} cards` : `Struggle Session: ${calculateQueueSize()} prompts ready`}</div>
                        </>
                    )}
                </div>

                {/* PAIN CARDS / FEEDBACK */}
                {(sessionCompleted || (isDrillMode && drillQueue.length === 0 && !loading && !activePainCard)) ? (
                    <div className="text-center py-8 md:py-12 px-4 border border-rose-900/50 rounded-sm bg-black/60 max-w-md w-full animate-in zoom-in backdrop-blur-sm z-10 relative">
                        <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-rose-600 mx-auto mb-4" />
                        <h3 className="text-2xl md:text-3xl font-heading text-rose-500 mb-2 tracking-widest font-bold italic">You are now eloquent.</h3>
                        <p className="text-rose-400 mb-6 font-body italic text-sm md:text-lg">Try not to be insufferable.</p>
                        {sessionReport && (
                            <div className="grid grid-cols-2 gap-2 mb-6 text-left">
                                {[
                                    ['Correct', sessionReport.correct],
                                    ['Again', sessionReport.incorrect],
                                    ['Skipped', sessionReport.skipped],
                                    ['Mastered', sessionReport.mastered]
                                ].map(([label, value]) => (
                                    <div key={label} className="border border-stone-800 bg-black/40 p-2 rounded-sm">
                                        <div className="text-[9px] uppercase tracking-widest text-stone-600">{label}</div>
                                        <div className="text-xl text-stone-100 font-heading">{value}</div>
                                    </div>
                                ))}
                                {sessionReport.missed.length > 0 && (
                                    <div className="col-span-2 border border-rose-900/40 bg-rose-950/20 p-2 rounded-sm">
                                        <div className="text-[9px] uppercase tracking-widest text-rose-500 mb-1">Review again</div>
                                        <div className="flex flex-wrap gap-1">{sessionReport.missed.map(item => <span key={item.hanzi} className="px-2 py-1 border border-stone-800 rounded-sm font-cn text-stone-300">{item.hanzi}</span>)}</div>
                                    </div>
                                )}
                            </div>
                        )}
                        <button onClick={exitPainSession} className="bg-stone-800 text-stone-300 px-6 md:px-8 py-2 text-[10px] md:text-xs font-body uppercase tracking-widest hover:bg-rose-900 transition-colors shadow-lg">Return to Deck</button>
                    </div>
                ) : (!isDrillMode && painMode === 'recurring' && !isReviewSession) ? (
                    <div className="text-center py-8 md:py-12 px-4 border border-emerald-900/40 rounded-sm bg-black/60 max-w-md w-full animate-in zoom-in backdrop-blur-sm z-10 relative">
                        <RefreshCw className="w-12 h-12 md:w-16 md:h-16 text-emerald-500 mx-auto mb-4" />
                        <h3 className="text-2xl md:text-3xl font-heading text-emerald-400 mb-2 tracking-widest font-bold italic">Recurring Pain</h3>
                        <p className="text-stone-500 mb-6 font-body italic text-sm md:text-lg">Choose due cards or all active cards above, then begin the spaced-repetition review session.</p>
                        <button onClick={startRecurringPain} disabled={recurringPromptCount === 0 || isStartingReview} className="bg-emerald-950/40 border border-emerald-800 text-emerald-200 px-6 md:px-8 py-2 text-[10px] md:text-xs font-body uppercase tracking-widest hover:bg-emerald-900 transition-colors shadow-lg disabled:opacity-40">{isStartingReview ? 'Starting Recurring...' : `Start Recurring (${recurringPromptCount})`}</button>
                    </div>
                ) : (!isDrillMode && painMode === 'struggle') ? (
                    <div className="text-center py-8 md:py-12 px-4 border border-rose-900/40 rounded-sm bg-black/60 max-w-md w-full animate-in zoom-in backdrop-blur-sm z-10 relative">
                        <Flame className="w-12 h-12 md:w-16 md:h-16 text-rose-600 mx-auto mb-4" />
                        <h3 className="text-2xl md:text-3xl font-heading text-rose-400 mb-2 tracking-widest font-bold italic">Struggle Session</h3>
                        <p className="text-stone-500 mb-6 font-body italic text-sm md:text-lg">Choose a target above, then start a focused drill. Results still update Recurring Pain intervals.</p>
                        <button onClick={startConfiguredDrillMode} disabled={calculateQueueSize() === 0} className="bg-rose-900/50 border border-rose-800 text-rose-200 px-6 md:px-8 py-2 text-[10px] md:text-xs font-body uppercase tracking-widest hover:bg-rose-800 transition-colors shadow-lg disabled:opacity-40">Start Struggle ({calculateQueueSize()})</button>
                    </div>
                ) : (!loading && cards.length > 0 && reviewCards.length === 0 && reviewMode === 'due') ? (
                    <div className="text-center py-8 md:py-12 px-4 border border-emerald-900/30 rounded-sm bg-black/60 max-w-md w-full animate-in zoom-in backdrop-blur-sm z-10 relative">
                        <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-emerald-500 mx-auto mb-4" />
                        <h3 className="text-2xl md:text-3xl font-heading text-emerald-400 mb-2 tracking-widest font-bold italic">No reviews due today.</h3>
                        <p className="text-stone-500 mb-6 font-body italic text-sm md:text-lg">Switch to All Cards or start a custom drill if you want more pain.</p>
                        <button onClick={() => setReviewMode('all')} className="bg-stone-800 text-stone-300 px-6 md:px-8 py-2 text-[10px] md:text-xs font-body uppercase tracking-widest hover:bg-rose-900 transition-colors shadow-lg">Show All Cards</button>
                    </div>
                ) : (!loading && cards.length > 0 && filteredCards.length === 0) ? (
                    <div className="text-center py-8 md:py-12 px-4 border border-emerald-900/30 rounded-sm bg-black/60 max-w-md w-full animate-in zoom-in backdrop-blur-sm z-10 relative">
                        <Award className="w-12 h-12 md:w-16 md:h-16 text-emerald-700 mx-auto mb-4" />
                        <h3 className="text-2xl md:text-3xl font-heading text-emerald-600 tracking-widest font-bold italic">All Words Mastered</h3>
                        <p className="text-stone-500 mb-6 font-body italic text-sm md:text-lg">The deck is conquered. Inject more pain from the Athenaeum.</p>
                    </div>
                ) : (!loading && cards.length === 0) ? (
                    <div className="text-center py-8 md:py-12 px-4 border border-stone-800 rounded-sm bg-black/60 max-w-md w-full backdrop-blur-sm z-10 relative">
                        <BrainCircuit className="w-10 h-10 md:w-12 md:h-12 text-stone-600 mx-auto mb-4" />
                        <h3 className="text-2xl md:text-3xl font-heading text-stone-300 tracking-widest font-bold italic">Neural Schema Empty</h3>
                        <p className="text-stone-500 mb-6 font-body italic text-sm md:text-lg">Inject vocabulary directly from the Reader or upload a batch.</p>
                        <button onClick={() => setCurrentAppView('reader')} className="inline-flex items-center gap-2 bg-rose-900 text-white px-4 md:px-6 py-2 text-[10px] md:text-xs font-body uppercase tracking-widest hover:bg-rose-800 transition-colors"><Scroll className="w-3 h-3 md:w-4 md:h-4" />Go to Athenaeum</button>
                    </div>
                ) : activePainCard ? (
                    <>
                    {nuanceFeedback && !isMcq && (
                        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 z-50 p-4 md:p-6 rounded-sm shadow-2xl max-w-[90vw] md:max-w-sm w-full text-center animate-in fade-in zoom-in border ${nuanceFeedback.type === 'correct' ? 'bg-emerald-950/95 border-emerald-600' : 'bg-red-950/95 border-rose-600'}`}>
                            {nuanceFeedback.type === 'correct' ? <CheckCircle className="w-10 h-10 md:w-12 md:h-12 text-emerald-500 mx-auto mb-2" /> : <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 text-rose-600 mx-auto mb-2" />}
                            <h4 className={`text-lg md:text-xl font-heading italic mb-2 font-bold ${nuanceFeedback.type === 'correct' ? 'text-emerald-400' : 'text-rose-500'}`}>{nuanceFeedback.type === 'correct' ? 'Correct' : 'Incorrect Nuance'}</h4>
                            <p className="text-stone-200 font-body italic text-base md:text-lg leading-relaxed break-words">{nuanceFeedback.text}</p>
                        </div>
                    )}
                    
                    {/* FLASHCARD CORE */}
                    <div
                        className="w-full max-w-md perspective-1000 relative group mb-2 overflow-visible z-10"
                        style={{ height: 'min(620px, calc(100dvh - 230px))', minHeight: '360px' }}
                    >
                        <div className={`relative w-full h-full transition-all duration-500 preserve-3d cursor-pointer shadow-2xl rounded-sm ${isFlipped && !isMcq ? 'rotate-y-180' : ''}`} onClick={() => !isMcq && setIsFlipped(!isFlipped)}>
                            
                            {/* Front */}
                            <div
                                className={`absolute w-full h-full backface-hidden rounded-sm border p-4 md:p-6 flex flex-col justify-between items-center text-center transition-colors z-10 overflow-y-auto custom-scrollbar ${isDrillMode ? 'bg-black/95 backdrop-blur-md border-rose-900/50' : 'bg-black/80 backdrop-blur-md border-stone-800 hover:border-rose-900/50'}`}
                                style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
                            >
                                
                                {/* Watermark Front */}
                                {activeEffect.text && (
                                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
                                      <div className={`text-4xl md:text-6xl font-gothic uppercase tracking-widest text-center rotate-[-25deg] select-none opacity-20 md:opacity-30 font-bold w-[150%] ${activeEffect.bgClass || 'text-stone-800'}`}>
                                         {activeEffect.text}
                                      </div>
                                   </div>
                                )}

                                <div className="w-full flex justify-between items-start z-10 shrink-0">
                                    <div className={`text-[8px] md:text-[10px] font-body uppercase tracking-wider px-2 py-1 rounded-sm border ${getCategoryColor(activePainCard.category)} flex items-center max-w-[60%] truncate`}>
                                        {isNuance ? <Scale className="w-3 h-3 mr-1 shrink-0" /> : isRegister ? <Scroll className="w-3 h-3 mr-1 shrink-0" /> : isMonoDef ? <Languages className="w-3 h-3 mr-1 shrink-0" /> : isCloze ? <BrainCircuit className="w-3 h-3 mr-1 shrink-0" /> : null}
                                        <span className="truncate">{isNuance ? 'Nuance Check' : isRegister ? 'Register Tag' : isMonoDef ? 'Mono Definition' : isCloze ? 'Cloze Test' : isMcq ? 'Multiple Choice' : activePainCard.category}</span>
                                    </div>
                                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                                        <div className="flex items-center gap-1 bg-black/60 rounded-sm px-1.5 md:px-2 py-1 border border-stone-800 z-20">
                                            <span className="text-[9px] md:text-[10px] font-body text-stone-300 mr-1">Streak:</span> 
                                            <span className={`text-[9px] md:text-[10px] font-body font-bold ${activePainCard.streak > 0 ? 'text-emerald-400' : activePainCard.streak < 0 ? 'text-rose-400' : 'text-stone-400'}`}>{activePainCard.streak || 0}</span>
                                        </div>
                                        <div className="hidden sm:flex items-center gap-1 bg-black/60 rounded-sm px-2 py-1 border border-stone-800 text-[9px] text-stone-500">
                                            Due {activePainCard.dueDate || todayKey()} · Ease {(activePainCard.ease || 2.5).toFixed(2)}
                                        </div>
                                        {!isDrillMode && (<button onClick={(e) => { e.stopPropagation(); setEditingCard({ ...activePainCard, tags: (activePainCard.tags || []).join(', ') }); }} className="text-stone-600 hover:text-emerald-400 p-1"><Feather className="w-3 h-3 md:w-4 md:h-4" /></button>)}
                                        {!isDrillMode && (<button onClick={handlePainDelete} className="text-stone-600 hover:text-red-500 p-1"><Trash2 className="w-3 h-3 md:w-4 md:h-4" /></button>)}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 w-full animate-in fade-in zoom-in duration-300 items-center justify-center flex-grow z-10 py-4">
                                    {isCloze || isNuance ? (
                                        <div className="flex flex-col items-center gap-2 md:gap-4 w-full">
                                            <h2 className={`text-xl sm:text-3xl md:text-4xl font-cn leading-tight px-2 md:px-4 break-words break-all w-full ${cardStyle.className}`} style={cardStyle.style}>
                                                {renderClozeSentence(activePainCard.example, activePainCard.clozeTarget || activePainCard.hanzi, true)}
                                            </h2>
                                            {isCloze && <p className="text-sm md:text-lg text-stone-400 font-body italic break-words w-full">{activePainCard.example_meaning}</p>}
                                        </div>
                                    ) : isRegister ? (
                                        <div className="flex flex-col items-center gap-2 w-full">
                                            <h2 className={`text-4xl sm:text-5xl md:text-7xl font-cn tracking-wide leading-tight break-words w-full ${cardStyle.className}`} style={cardStyle.style}>
                                                {script === 'TC' ? contextConvert(activePainCard.hanzi) : activePainCard.hanzi}
                                            </h2>
                                            {activePainCard.pinyin && <p className="text-lg md:text-2xl text-stone-400 font-body break-words w-full">{activePainCard.pinyin}</p>}
                                            {activePainCard.meaning && <p className="text-sm md:text-lg text-stone-300 font-body italic leading-relaxed break-words w-full">{activePainCard.meaning}</p>}
                                        </div>
                                    ) : isMonoDef ? (
                                        <h2 className={`text-4xl sm:text-5xl md:text-7xl font-cn tracking-wide leading-tight break-words w-full ${cardStyle.className}`} style={cardStyle.style}>
                                            {script === 'TC' ? contextConvert(activePainCard.hanzi) : activePainCard.hanzi}
                                        </h2>
                                    ) : (
                                        <h2 className={`text-4xl sm:text-5xl md:text-7xl font-cn tracking-wide leading-tight break-words w-full ${cardStyle.className}`} style={cardStyle.style}>
                                            {isMcq ? (script === 'TC' ? contextConvert(activePainCard.hanzi) : activePainCard.hanzi) : (isReverse ? activePainCard.meaning : (script === 'TC' ? contextConvert(activePainCard.hanzi) : activePainCard.hanzi))}
                                        </h2>
                                    )}

                                    {isMcq ? (
                                        <div className="w-full mt-4 space-y-3">
                                            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                                                {activePainCard._options && activePainCard._options.map((option, idx) => {
                                                    let btnClass = "bg-stone-900/90 hover:bg-rose-900/40 border border-stone-800 hover:border-rose-700 text-stone-300 opacity-95";
                                                    const isCorrect = (activePainCard._type === 'mcq-register' ? normalizeRegister(option.value || option.label) === getCardRegister(activePainCard) : (!option.isDistractor && option.id === activePainCard.id));
                                                    
                                                    if (mcqFeedback) {
                                                        const optionId = option.id || option.value || option.label;
                                                        const selectedIsThis = optionId === mcqFeedback.selectedId;
                                                        if (isCorrect) btnClass = "bg-emerald-900/90 border-emerald-500 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                                                        else if (selectedIsThis && !mcqFeedback.isCorrect) btnClass = "bg-red-950/90 border-red-600 text-red-200 shake shadow-[0_0_10px_rgba(220,38,38,0.3)]";
                                                        else btnClass = "opacity-30 border border-stone-900 bg-black";
                                                    }

                                                    const optionText = isCloze ? option.hanzi : isNuance ? option.hanzi : isRegister ? option.label : isMonoDef ? option.definition_cn : option.meaning;
                                                    const displayOptionText = (script === 'TC' && (isCloze || isNuance || isMonoDef)) ? contextConvert(optionText) : optionText;
                                                    const optionFontClass = (isCloze || isNuance || isMonoDef) ? 'font-cn' : 'font-body';

                                                    return (
                                                        <button key={idx} onClick={(e) => {e.stopPropagation(); handleMcqSelect(option);}} disabled={!!mcqFeedback} className={`${btnClass} p-2 md:p-3 rounded-sm text-xs md:text-sm transition-all duration-300 flex items-center justify-center relative group min-h-[44px]`}>
                                                            <span className="absolute left-2 opacity-30 text-[9px] md:text-xs font-bold font-body hidden sm:block">{idx === 0 ? 'Z' : idx === 1 ? 'X' : idx === 2 ? 'C' : 'V'}</span>
                                                            <span className={`font-medium text-center break-words w-full px-4 ${optionFontClass}`}>{displayOptionText}</span>
                                                            {mcqFeedback && isCorrect && <CheckCircle className="absolute right-2 w-4 h-4 text-emerald-300" />}
                                                            {mcqFeedback && !isCorrect && ((option.id || option.value || option.label) === mcqFeedback.selectedId) && <XCircle className="absolute right-2 w-4 h-4 text-red-300" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {mcqFeedback && (
                                                <div className={`border p-2 rounded-sm text-xs md:text-sm font-body ${mcqFeedback.isCorrect ? 'border-emerald-900/40 bg-emerald-950/25 text-emerald-300' : 'border-rose-900/40 bg-rose-950/20 text-rose-200'}`}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        {mcqFeedback.isCorrect ? <CheckCircle className="w-4 h-4 text-emerald-300" /> : <XCircle className="w-4 h-4 text-rose-300" />}
                                                        <span>{mcqFeedback.isCorrect ? 'Correct' : 'Correct answer:'}</span>
                                                        <span className={(isCloze || isNuance || isMonoDef) ? 'font-cn text-stone-100' : 'text-stone-100'}>{mcqFeedback.correctLabel}</span>
                                                    </div>
                                                    {nuanceFeedback?.text && <p className="mt-1 text-stone-400 italic leading-relaxed">{nuanceFeedback.text}</p>}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {!isReverse && (<button onClick={(e) => handleSpeak(activePainCard.hanzi, e)} className={`flex items-center gap-2 px-3 py-1 rounded-sm text-sm transition-all mt-2 shrink-0 ${isSpeaking ? 'bg-rose-900/50 text-rose-300 ring-1 ring-rose-700' : 'bg-stone-900 text-stone-500 hover:bg-stone-800'}`}><Volume2 className="w-4 h-4" /></button>)}
                                            <p className={`text-lg md:text-xl font-light font-body mt-1 md:mt-2 mb-2 md:mb-4 break-words w-full ${isDrillMode ? 'text-stone-400' : 'text-stone-500'}`}>{isReverse ? '' : activePainCard.pinyin}</p>
                                            {activePainCard.example && (
                                                <div className="mt-2 w-full text-xs md:text-sm p-2 md:p-3 rounded-sm text-left bg-black/50 border border-stone-800">
                                                    <div className="flex items-start gap-1 md:gap-2"><Quote className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0 mt-1 text-stone-600" /><div className="flex-grow min-w-0"><p className="text-stone-300 font-cn text-base md:text-lg break-words break-all">{renderClozeSentence(activePainCard.example, activePainCard.clozeTarget || activePainCard.hanzi, false)}</p></div><button onClick={(e) => handleSpeak(activePainCard.example, e)} className="p-1 text-stone-600 hover:text-stone-300 shrink-0"><Volume2 className="w-3 h-3" /></button></div>
                                                    {!isReverse && activePainCard.example_meaning && (<p className="mt-1 md:mt-2 ml-4 md:ml-6 text-[10px] md:text-sm italic text-stone-500 font-body break-words">{activePainCard.example_meaning}</p>)}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                {!isMcq && (<div className="text-[9px] md:text-[10px] font-body uppercase tracking-widest text-stone-600 mt-auto z-10 shrink-0"><RefreshCw className="w-3 h-3 inline mr-1" /><span className="hidden sm:inline">Space to flip</span><span className="sm:hidden">Tap to flip</span></div>)}
                            </div>

                            {/* Back */}
                            <div
                                className={`absolute w-full h-full backface-hidden rounded-sm border p-4 md:p-6 flex flex-col justify-between items-center text-center rotate-y-180 z-10 overflow-y-auto custom-scrollbar ${isDrillMode ? 'bg-black/95 backdrop-blur-md border-rose-900/50' : 'bg-black/80 backdrop-blur-md border-stone-800'}`}
                                style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
                            >
                                
                                {/* Watermark Back */}
                                {activeEffect.text && (
                                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
                                      <div className={`text-4xl md:text-6xl font-gothic uppercase tracking-widest text-center rotate-[-25deg] select-none opacity-20 md:opacity-30 font-bold w-[150%] ${activeEffect.bgClass || 'text-stone-800'}`}>
                                         {activeEffect.text}
                                      </div>
                                   </div>
                                )}

                                <div className="flex flex-col gap-1 md:gap-2 w-full justify-center items-center flex-grow z-10 pt-4 md:pt-8">
                                    <h3 className={`text-3xl sm:text-4xl font-bold font-cn tracking-wide break-words w-full px-2 ${cardStyle.className}`} style={cardStyle.style}>
                                        {isReverse ? (script === 'TC' ? contextConvert(activePainCard.hanzi) : activePainCard.hanzi) : activePainCard.meaning}
                                    </h3>
                                    {isReverse && (<p className="text-lg md:text-xl font-body text-rose-400 mb-1 md:mb-2 break-words">{activePainCard.pinyin}</p>)}
                                    {isReverse && (<button onClick={(e) => handleSpeak(activePainCard.hanzi, e)} className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-stone-800 text-stone-400 hover:bg-stone-700 mb-2 md:mb-4 shrink-0"><Volume2 className="w-3 h-3 md:w-4 md:h-4" /></button>)}
                                    <p className="leading-relaxed max-w-xs text-sm md:text-lg italic mb-2 md:mb-4 text-stone-400 font-body break-words">{activePainCard.notes}</p>
                                    {activePainCard.example && (
                                        <div className="w-full text-xs md:text-sm p-2 md:p-3 rounded-sm text-left bg-black/50 border border-stone-800">
                                            <div className="flex items-start gap-1 md:gap-2"><Quote className="w-3 h-3 md:w-4 md:h-4 mt-1 text-rose-700 shrink-0" /><div className="flex-grow min-w-0"><p className="text-stone-200 font-cn text-base md:text-lg break-words break-all">{script === 'TC' ? contextConvert(activePainCard.example) : activePainCard.example}</p></div><button onClick={(e) => handleSpeak(activePainCard.example, e)} className="p-1 text-stone-500 hover:text-white shrink-0"><Volume2 className="w-3 h-3" /></button></div>
                                            {!isReverse && activePainCard.example_meaning && (<p className="mt-1 md:mt-2 ml-4 md:ml-6 text-[10px] md:text-sm italic text-stone-500 font-body break-words">{activePainCard.example_meaning}</p>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="fixed left-0 right-0 bottom-0 z-50 bg-black/95 border-t border-stone-800 p-2 md:p-3" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
                        {isMcq ? (
                            <div className="mx-auto w-full max-w-md grid grid-cols-3 gap-2">
                                <button onClick={skipActiveCard} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-stone-900 border border-stone-800 text-stone-400 hover:bg-stone-800"><SkipForward className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Skip</span></button>
                                <button onClick={markActiveCardKnown} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-blue-950/30 border border-blue-900 text-blue-400 hover:bg-blue-900/50"><Trophy className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Known</span></button>
                                <button onClick={continueAfterMcq} disabled={!mcqFeedback} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-rose-900/40 border border-rose-900 text-rose-300 hover:bg-rose-900 disabled:opacity-40"><ChevronRight className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">{mcqFeedback ? 'Continue' : 'Answer'}</span></button>
                                <div className="col-span-3 text-center text-[10px] md:text-xs font-body text-stone-500 whitespace-nowrap">{isDrillMode ? `${Math.max(0, initialQueueSize - drillQueue.length + 1)} / ${initialQueueSize || 1}` : `${currentCardIndex + 1} / ${activeReviewQueue.length}`}</div>
                            </div>
                        ) : isDrillMode ? (
                            <div className="mx-auto w-full max-w-md grid grid-cols-4 gap-2">
                                <button onClick={(e) => handleDrillAction('again', e)} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-stone-900 border border-stone-800 text-rose-400 hover:bg-rose-950"><RotateCcw className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Again</span></button>
                                <button onClick={(e) => handleDrillAction('right', e)} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-emerald-950/30 border border-emerald-900 text-emerald-400 hover:bg-emerald-900/50"><CheckCircle className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Right</span></button>
                                <button onClick={skipActiveCard} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-stone-900 border border-stone-800 text-stone-400 hover:bg-stone-800"><SkipForward className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Skip</span></button>
                                <button onClick={markActiveCardKnown} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-blue-950/30 border border-blue-900 text-blue-400 hover:bg-blue-900/50"><Trophy className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Known</span></button>
                                <div className="col-span-4 text-center text-[10px] md:text-xs font-body text-stone-500 whitespace-nowrap">{Math.max(0, initialQueueSize - drillQueue.length + 1)} / {initialQueueSize || 1}</div>
                            </div>
                        ) : (
                            <div className="mx-auto w-full max-w-md grid grid-cols-4 gap-2">
                                <button onClick={() => handlePainNext('incorrect')} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-red-950/30 border border-red-900 text-red-400 hover:bg-red-900/50"><XCircle className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Wrong</span></button>
                                <button onClick={() => handlePainNext('correct')} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-emerald-950/30 border border-emerald-900 text-emerald-400 hover:bg-emerald-900/50"><CheckCircle className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Right</span></button>
                                <button onClick={skipActiveCard} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-stone-900 border border-stone-800 text-stone-400 hover:bg-stone-800"><SkipForward className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Skip</span></button>
                                <button onClick={markActiveCardKnown} className="min-h-[50px] flex flex-col items-center justify-center rounded-sm bg-blue-950/30 border border-blue-900 text-blue-400 hover:bg-blue-900/50"><Trophy className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase tracking-widest">Known</span></button>
                                <div className="col-span-4 text-center text-[10px] md:text-xs font-body text-stone-500 whitespace-nowrap">{currentCardIndex + 1} / {activeReviewQueue.length}</div>
                            </div>
                        )}
                    </div>
                    </>
                ) : null}
             </div>
          )}

          {/* ========================================================= */}
          {/* ===================== MODALS ============================ */}
          {/* ========================================================= */}

          {/* --- MANUAL MODAL (CODEX OF OPERATIONS) --- */}
          {showManualModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300 p-2 md:p-4">
               <div className="relative w-full max-w-4xl bg-zinc-950 border border-stone-800 shadow-2xl p-6 md:p-8 flex flex-col rounded-sm h-[90vh] overflow-hidden">
                  <div className="flex justify-between items-center mb-6 shrink-0">
                      <h3 className="font-heading text-2xl md:text-3xl text-stone-100 italic flex items-center gap-2"><Info className="w-5 h-5 md:w-6 md:h-6 text-rose-700"/> Codex of Operations</h3>
                      <button onClick={() => setShowManualModal(false)} className="text-stone-500 hover:text-rose-500 p-1"><X className="w-5 h-5 md:w-6 md:h-6"/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 font-body text-stone-300 space-y-6">
                      
                      <section>
                          <h4 className="text-xl font-heading text-rose-500 border-b border-stone-800 pb-2 mb-3 italic">1. Hemisphere L: The Athenaeum</h4>
                          <p className="mb-2 leading-relaxed">The Athenaeum is the semantic extraction engine. It is designed for deep reading and corpus alignment. It does not train vocabulary; it isolates it.</p>
                          <ul className="list-disc pl-5 space-y-2 text-sm text-stone-400">
                              <li><strong className="text-stone-200">Scribe's Input (+):</strong> Upload a raw Chinese text or a 3-column TSV (`Simplified [TAB] Traditional [TAB] English`).</li>
                              <li><strong className="text-stone-200">Orthographic Unification (简/繁):</strong> Toggling script masks the text, but the underlying data point remains unified in Simplified.</li>
                              <li><strong className="text-stone-200">Harvest OOV (Ghost Icon):</strong> Extracts any word in the text that does not currently exist in your Glossary or PAIN schema. Perfect for pre-training a text.</li>
                              <li><strong className="text-stone-200">Lexical Chromatics:</strong> Words glow based on your PAIN Engine performance. Grey (Unknown), White (Glossary only), Blue (Untrained PAIN), Amber (Training), Red (Necrosis/Failing), Emerald (Rapture/Mastered).</li>
                          </ul>
                      </section>

                      <section>
                          <h4 className="text-xl font-heading text-rose-500 border-b border-stone-800 pb-2 mb-3 italic">2. Hemisphere R: The PAIN Engine</h4>
                          <p className="mb-2 leading-relaxed">Pathological Acquisition of Intellectual Necrosis. A spaced-repetition torture matrix built to permanently encode linguistic anomalies into your biological hardware.</p>
                          <ul className="list-disc pl-5 space-y-2 text-sm text-stone-400">
                              <li><strong className="text-stone-200">Continuous Fire:</strong> Holding down `W` (Wrong) or `R` (Right) overrides the OS debounce delay, executing the grading matrix 5 times a second for rapid reviewing.</li>
                              <li><strong className="text-stone-200">The Streak Gradient:</strong> Words are dynamically coloured. `0` is neutral stone. `-50` triggers a bloody red animation and removal. `+50` triggers an emerald divine glow and removal. Mistakes at `+50` pull the streak down incrementally.</li>
                              <li><strong className="text-stone-200">Drill Modes:</strong> Flashcards, MCQ, Cloze (Fill-in-the-blank), Nuance Checks, Register definitions, and Monolingual tracking.</li>
                          </ul>
                      </section>

                      <section>
                          <h4 className="text-xl font-heading text-rose-500 border-b border-stone-800 pb-2 mb-3 italic">3. The 11-Column PAIN Schema</h4>
                          <p className="mb-2 leading-relaxed text-sm text-stone-400">All uploads into the PAIN engine or the Athenaeum Glossary must adhere strictly to this TSV (Tab-Separated Values) format. Missing trailing columns are permitted, but order is absolute.</p>
                          <div className="bg-black/50 p-4 border border-stone-800 rounded-sm font-tech text-[10px] sm:text-xs text-stone-300 whitespace-pre-wrap">
                              1. Hanzi (Target Word) <br/>
                              2. Pinyin <br/>
                              3. Meaning (English) <br/>
                              4. Category (e.g., Politics, Lit) <br/>
                              5. Notes (Syntactic/Mnemonic) <br/>
                              6. Example Sentence (CN) <br/>
                              7. Example Translation (EN) <br/>
                              8. Distractors (Comma-separated) <br/>
                              9. Nuance Tip <br/>
                              10. Register (Formal, Colloquial, etc.) <br/>
                              11. Monolingual Def (CN)
                          </div>
                      </section>

                      <section>
                          <h4 className="text-xl font-heading text-rose-500 border-b border-stone-800 pb-2 mb-3 italic">4. Keyboard Mapping</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-stone-400">
                              <div><strong className="text-stone-200">Space / F</strong> : Flip Card</div>
                              <div><strong className="text-stone-200">W</strong> : Wrong / Again (Hold for continuous)</div>
                              <div><strong className="text-stone-200">R</strong> : Right (Hold for continuous)</div>
                              <div><strong className="text-stone-200">E</strong> : Immediate Mastery (+50)</div>
                              <div><strong className="text-stone-200">A / ←</strong> : Previous Card (Reader Mode)</div>
                              <div><strong className="text-stone-200">D / →</strong> : Next Card / Skip</div>
                              <div><strong className="text-stone-200">Z, X, C, V</strong> : Select MCQ Options (1-4)</div>
                              <div><strong className="text-stone-200">S</strong> : Speak Audio</div>
                          </div>
                      </section>

                  </div>
               </div>
            </div>
          )}

          {/* --- STATS MODAL --- */}
          {showStatsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300 p-2 md:p-4">
               <div className="relative w-full max-w-4xl bg-zinc-950 border border-stone-800 shadow-2xl p-6 md:p-8 flex flex-col rounded-sm h-[90vh] overflow-hidden">
                  <div className="flex justify-between items-center mb-6 shrink-0">
                      <h3 className="font-heading text-2xl md:text-3xl text-stone-100 italic flex items-center gap-2"><Activity className="w-5 h-5 md:w-6 md:h-6 text-rose-700"/> Analytics & Surveillance</h3>
                      <button onClick={() => setShowStatsModal(false)} className="text-stone-500 hover:text-rose-500 p-1"><X className="w-5 h-5 md:w-6 md:h-6"/></button>
                  </div>

                  <div className="flex gap-2 mb-6 border-b border-stone-800 pb-4 shrink-0 overflow-x-auto custom-scrollbar">
                      {['1W', '1M', '3M', '6M', '1Y'].map(f => (
                          <button key={f} onClick={() => setStatsFilter(f)} className={`px-4 py-1 font-body text-xs tracking-widest transition-colors border rounded-sm shrink-0 ${statsFilter === f ? 'bg-rose-900/30 border-rose-800 text-rose-400' : 'border-stone-800 text-stone-500 hover:text-stone-300'}`}>
                              {f}
                          </button>
                      ))}
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                      {(() => {
                          const now = new Date();
                          let daysBack = 7;
                          if (statsFilter === '1M') daysBack = 30;
                          if (statsFilter === '3M') daysBack = 90;
                          if (statsFilter === '6M') daysBack = 180;
                          if (statsFilter === '1Y') daysBack = 365;

                          const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
                          const filteredStats = activityData.filter(d => d.date >= startDate).sort((a, b) => a.date.localeCompare(b.date));

                          const chartData = [];
                          for(let i = daysBack - 1; i >= 0; i--) {
                              const dStr = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
                              const existing = filteredStats.find(s => s.date === dStr);
                              chartData.push(existing || { date: dStr, lookups: 0, injections: 0, reviews: 0, correct: 0, incorrect: 0, mastered: 0, necrosis: 0 });
                          }

                          const totalLookups = chartData.reduce((sum, d) => sum + (d.lookups || 0), 0);
                          const totalInjections = chartData.reduce((sum, d) => sum + (d.injections || 0), 0);
                          const totalReviews = chartData.reduce((sum, d) => sum + (d.reviews || 0), 0);
                          const totalCorrect = chartData.reduce((sum, d) => sum + (d.correct || 0), 0);
                          const totalIncorrect = chartData.reduce((sum, d) => sum + (d.incorrect || 0), 0);
                          const totalMastered = chartData.reduce((sum, d) => sum + (d.mastered || 0), 0);
                          const totalNecrosis = chartData.reduce((sum, d) => sum + (d.necrosis || 0), 0);
                          
                          const accuracy = totalReviews > 0 ? Math.round((totalCorrect / (totalCorrect + totalIncorrect || 1)) * 100) : 0;
                          const maxVolume = Math.max(...chartData.map(d => (d.lookups || 0) + (d.reviews || 0)), 1);

                          return (
                              <div className="space-y-8">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      <div className="bg-black/50 border border-stone-800 p-4 rounded-sm">
                                          <div className="text-[10px] uppercase font-body text-stone-500 mb-1">Lookups (Athenaeum)</div>
                                          <div className="text-3xl font-heading text-stone-200">{totalLookups}</div>
                                      </div>
                                      <div className="bg-black/50 border border-stone-800 p-4 rounded-sm">
                                          <div className="text-[10px] uppercase font-body text-stone-500 mb-1">Injected into PAIN</div>
                                          <div className="text-3xl font-heading text-stone-200">{totalInjections}</div>
                                      </div>
                                      <div className="bg-black/50 border border-stone-800 p-4 rounded-sm">
                                          <div className="text-[10px] uppercase font-body text-stone-500 mb-1">Total Reviews</div>
                                          <div className="text-3xl font-heading text-stone-200">{totalReviews}</div>
                                      </div>
                                      <div className="bg-black/50 border border-stone-800 p-4 rounded-sm">
                                          <div className="text-[10px] uppercase font-body text-stone-500 mb-1">Accuracy</div>
                                          <div className="text-3xl font-heading text-emerald-400">{accuracy}%</div>
                                      </div>
                                      <div className="bg-black/50 border border-stone-800 p-4 rounded-sm">
                                          <div className="text-[10px] uppercase font-body text-emerald-600/80 mb-1">Sublimated (Mastered)</div>
                                          <div className="text-3xl font-heading text-emerald-500">{totalMastered}</div>
                                      </div>
                                      <div className="bg-black/50 border border-stone-800 p-4 rounded-sm">
                                          <div className="text-[10px] uppercase font-body text-red-600/80 mb-1">Necrosis (Failed)</div>
                                          <div className="text-3xl font-heading text-red-500">{totalNecrosis}</div>
                                      </div>
                                      <div className="bg-black/50 border border-stone-800 p-4 rounded-sm">
                                          <div className="text-[10px] uppercase font-body text-stone-500 mb-1">Correct Answers</div>
                                          <div className="text-3xl font-heading text-emerald-400/80">{totalCorrect}</div>
                                      </div>
                                      <div className="bg-black/50 border border-stone-800 p-4 rounded-sm">
                                          <div className="text-[10px] uppercase font-body text-stone-500 mb-1">Incorrect Answers</div>
                                          <div className="text-3xl font-heading text-red-400/80">{totalIncorrect}</div>
                                      </div>
                                  </div>

                                  <div>
                                      <h4 className="font-heading text-xl text-stone-300 italic mb-4">Activity Volume (Lookups & Reviews)</h4>
                                      <div className="h-48 md:h-64 flex items-end gap-[1px] mt-2 border-b border-l border-stone-800 pb-1 pl-1">
                                          {chartData.map(day => {
                                              const val = (day.lookups || 0) + (day.reviews || 0);
                                              const heightPct = (val / maxVolume) * 100;
                                              return (
                                                  <div key={day.date} className="flex-1 bg-stone-700/50 hover:bg-rose-800/80 transition-colors relative group min-w-[2px]" style={{ height: `${heightPct}%` }}>
                                                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black border border-stone-800 text-stone-300 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 font-body">
                                                          {day.date}: {val} Actions
                                                      </div>
                                                  </div>
                                              )
                                          })}
                                      </div>
                                      <div className="flex justify-between text-[10px] text-stone-600 font-body mt-2">
                                          <span>{startDate}</span>
                                          <span>Today</span>
                                      </div>
                                  </div>
                              </div>
                          );
                      })()}
                  </div>
               </div>
            </div>
          )}

          {/* --- READER: HARVEST OOV MODAL --- */}
          {showHarvestModal && currentAppView === 'reader' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300 p-2 md:p-4">
               <div className="relative w-full max-w-lg bg-zinc-950 border border-stone-800 shadow-2xl p-6 md:p-8 flex flex-col rounded-sm">
                  <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
                      <h3 className="font-heading text-2xl md:text-3xl text-stone-100 italic flex items-center gap-2"><Ghost className="w-5 h-5 md:w-6 md:h-6 text-rose-700"/> Lexical Anomalies</h3>
                      <button onClick={() => setShowHarvestModal(false)} className="text-stone-500 hover:text-rose-500 p-1"><X className="w-5 h-5 md:w-6 md:h-6"/></button>
                  </div>
                  <p className="text-stone-400 text-xs md:text-sm font-body italic mb-4">
                      The segmenter isolated {harvestedWords.length} elements from this text that do not exist in your current schema.
                  </p>
                  <textarea 
                      readOnly 
                      value={harvestedWords.join('\n')} 
                      className="w-full h-48 md:h-64 bg-black/50 border border-stone-800 rounded-sm p-3 md:p-4 text-stone-300 font-cn text-base outline-none custom-scrollbar resize-y mb-6"
                  />
                  <div className="flex justify-end gap-3 md:gap-4 shrink-0">
                      <button onClick={injectHarvestedWords} disabled={isProcessing || harvestedWords.length === 0} className="px-4 md:px-6 py-2 bg-rose-900/20 border border-rose-900/50 text-rose-500 font-body text-[10px] md:text-xs uppercase tracking-widest hover:bg-rose-900/40 hover:text-rose-400 rounded-sm w-full sm:w-auto flex items-center justify-center gap-2">
                          <BrainCircuit className="w-3 h-3 md:w-4 md:h-4" /> Send to PAIN
                      </button>
                      <button onClick={copyHarvestToClipboard} className="px-4 md:px-6 py-2 bg-rose-900/20 border border-rose-900/50 text-rose-500 font-body text-[10px] md:text-xs uppercase tracking-widest hover:bg-rose-900/40 hover:text-rose-400 rounded-sm w-full sm:w-auto flex items-center justify-center gap-2">
                          <Clipboard className="w-3 h-3 md:w-4 md:h-4" /> Copy to Clipboard
                      </button>
                  </div>
               </div>
            </div>
          )}

          {/* --- READER: LEXICON MANAGER MODAL --- */}
          {showLexiconModal && currentAppView === 'reader' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300 p-2 md:p-4 lg:p-6">
                <div className="relative w-full max-w-5xl h-[90vh] md:h-[80vh] bg-zinc-950 border border-stone-800 shadow-2xl flex flex-col rounded-sm overflow-hidden">
                  <div className="p-4 md:p-8 flex flex-col h-full w-full">
                      <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
                          <h3 className="font-heading text-2xl md:text-3xl text-stone-100 italic flex items-center gap-2 md:gap-3"><Library className="w-5 h-5 md:w-6 md:h-6 text-rose-700"/> Athenaeum Glossary</h3>
                          <button onClick={() => setShowLexiconModal(false)} className="text-stone-500 hover:text-rose-500 p-1"><X className="w-5 h-5 md:w-6 md:h-6"/></button>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 md:mb-6 border-b border-stone-800 pb-4 shrink-0 w-full">
                          <div className="flex flex-wrap gap-2 md:gap-4 w-full sm:w-auto">
                            <input type="file" ref={tsvInputRef} onChange={handleLexiconTSVUpload} className="hidden" accept=".txt,.tsv,.csv" />
                            <button onClick={() => tsvInputRef.current?.click()} className="px-3 md:px-4 py-2 bg-stone-900 border border-stone-700 text-stone-300 font-body text-[10px] md:text-xs uppercase tracking-widest hover:border-rose-500 hover:text-rose-400 transition-colors flex items-center gap-1 md:gap-2 flex-1 sm:flex-none justify-center">
                                {isProcessing ? <Zap className="w-3 h-3 md:w-4 md:h-4 animate-pulse text-rose-500"/> : <Upload className="w-3 h-3 md:w-4 md:h-4"/>} <span className="whitespace-nowrap">Upload Lexicon TSV</span>
                            </button>
                            <button onClick={() => exportToTSV(Object.values(userDict), 'Athenaeum_Glossary.tsv')} className="px-3 md:px-4 py-2 bg-stone-900 border border-stone-700 text-stone-300 font-body text-[10px] md:text-xs uppercase tracking-widest hover:border-rose-500 hover:text-rose-400 transition-colors flex items-center gap-1 md:gap-2 flex-1 sm:flex-none justify-center">
                                <Download className="w-3 h-3 md:w-4 md:h-4"/> <span className="whitespace-nowrap">Export Glossary</span>
                            </button>
                            {selectedGlossaryTerms.size > 0 && (
                                <button onClick={handleBulkInject} disabled={isProcessing} className="px-3 md:px-4 py-2 bg-rose-900/40 border border-rose-900 text-rose-300 font-body text-[10px] md:text-xs uppercase tracking-widest hover:bg-rose-800 hover:text-white transition-colors flex items-center gap-1 md:gap-2 shadow-[0_0_15px_rgba(225,29,72,0.2)] flex-1 sm:flex-none justify-center">
                                    <BrainCircuit className="w-3 h-3 md:w-4 md:h-4"/> <span className="whitespace-nowrap">Inject ({selectedGlossaryTerms.size})</span>
                                </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                              <button onClick={() => setSelectedGlossaryTerms(prev => prev.size === filteredLexiconEntries.length ? new Set() : new Set(filteredLexiconEntries.map(([term]) => term)))} className="text-[10px] text-stone-500 hover:text-stone-300 font-body uppercase tracking-widest transition-colors border border-stone-800 px-2 py-1 rounded-sm sm:border-none sm:p-0">
                                  {selectedGlossaryTerms.size === filteredLexiconEntries.length ? 'Deselect All' : 'Select Visible'}
                              </button>
                              <div className="text-[10px] md:text-xs font-body text-stone-500 uppercase tracking-widest whitespace-nowrap">{filteredLexiconEntries.length} / {Object.keys(userDict).length} Terms</div>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 shrink-0">
                          <input value={lexiconSearch} onChange={(e) => setLexiconSearch(e.target.value)} placeholder="Search Hanzi, pinyin, meaning..." className="bg-black/40 border border-stone-800 rounded-sm px-3 py-2 text-stone-300 outline-none text-sm" />
                          <select value={lexiconCategory} onChange={(e) => setLexiconCategory(e.target.value)} className="bg-black/40 border border-stone-800 rounded-sm px-3 py-2 text-stone-300 outline-none text-sm">
                              {lexiconCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                      </div>

                      <div className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar border border-stone-900 bg-black/30 p-2 md:p-4 min-h-0 relative w-full">
                          {Object.keys(userDict).length === 0 ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-600 font-body italic gap-3 p-4 text-center">
                                  <AlertCircle className="w-8 h-8 opacity-50" /><p>The Glossary is empty.</p>
                              </div>
                          ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 w-full pb-4">
                                  {filteredLexiconEntries.map(([term, data]) => (
                                      <div key={term} onClick={() => setSelectedGlossaryTerms(prev => { const next = new Set(prev); if(next.has(term)) next.delete(term); else next.add(term); return next; })} className={`bg-stone-900/50 border ${selectedGlossaryTerms.has(term) ? 'border-rose-700 bg-rose-950/20' : 'border-stone-800'} p-3 md:p-4 rounded-sm group relative hover:border-rose-900/50 transition-colors cursor-pointer w-full overflow-hidden`}>
                                          <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all flex gap-1 bg-stone-900/90 rounded-sm p-1 sm:p-0">
                                              <button onClick={(e) => { e.stopPropagation(); injectIntoPAIN(term, data); }} className="text-stone-500 hover:text-emerald-400 transition-colors p-1" title="Inject into PAIN Engine"><BrainCircuit className="w-3 h-3 md:w-4 md:h-4" /></button>
                                              <button onClick={(e) => { e.stopPropagation(); deleteVocabTerm(term); }} className="text-stone-500 hover:text-rose-600 transition-colors p-1" title="Delete from Lexicon"><Trash2 className="w-3 h-3 md:w-4 md:h-4" /></button>
                                          </div>
                                          <div className="flex items-start justify-between mb-1 pr-12">
                                              <div className="font-cn text-xl md:text-2xl text-stone-200 truncate">{term}</div>
                                              <div className={`w-3 h-3 md:w-4 md:h-4 rounded-sm border shrink-0 ${selectedGlossaryTerms.has(term) ? 'bg-rose-600 border-rose-600' : 'border-stone-600'}`}></div>
                                          </div>
                                          <div className="text-rose-500 text-[10px] md:text-xs font-body mb-1 md:mb-2 truncate">{data.pinyin}</div>
                                          <div className="text-xs md:text-sm text-stone-400 font-body italic line-clamp-2 break-words">{data.meaning || data.def}</div>
                                          {data.category && <div className="mt-2 text-[8px] md:text-[9px] uppercase tracking-widest font-body text-stone-600 border border-stone-700 inline-block px-1 rounded-sm max-w-full truncate">{data.category}</div>}
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
                </div>
            </div>
          )}

          {/* --- READER: DEEP DIVE MODAL --- */}
          {selection && activeManuscriptId && currentAppView === 'reader' && readerPanelOpen && (
            <div className="fixed right-0 top-0 bottom-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto no-print p-3 w-full sm:w-[420px]">
              <div className="relative w-full bg-zinc-950 border border-stone-800 shadow-2xl p-1 rounded-sm overflow-y-auto custom-scrollbar">
                <div className="p-6 md:p-8 relative overflow-hidden">
                  <button onClick={closeModal} className="absolute top-2 right-2 md:top-4 md:right-4 text-stone-600 hover:text-rose-600 p-2"><X className="w-5 h-5" /></button>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 mb-6 md:mb-8 text-center sm:text-left pt-4 sm:pt-0">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-black border border-stone-800 flex items-center justify-center shadow-inner shadow-rose-950/30 shrink-0 rounded-sm">
                      <span className={`font-cn text-stone-100 drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] break-all px-2 ${selection.text.length > 2 ? 'text-xl' : selection.text.length > 1 ? 'text-3xl' : 'text-5xl md:text-6xl'}`}>
                          {script === 'TC' ? convertToSC(selection.text) : selection.text}
                      </span>
                    </div>
                    <div className="min-w-0 w-full">
                      <h3 className="font-heading text-2xl md:text-3xl text-rose-700 mb-1 border-b border-rose-900/30 pb-1 italic font-bold truncate">Analysis</h3>
                      <p className="font-body text-stone-500 italic text-xs md:text-sm mt-2">{selection.text.length > 1 ? "Compound Term / Phrase" : "Single Character"}</p>
                    </div>
                  </div>
                  
                  {(() => {
                      const analysisText = script === 'TC' ? convertToSC(selection.text) : selection.text;
                      const result = getLookupResult(analysisText);
                      const currentSegment = data.find(s => s.id === selection.segmentId);
                      const contextSentence = currentSegment?.sc;
                      const contextTranslation = currentSegment?.en;

                      return (
                        <div className="space-y-4">
                            <div className="border-b border-stone-800 pb-3">
                                <div className="flex items-center gap-2 text-[9px] md:text-[10px] uppercase tracking-widest text-stone-600 mb-1 font-body"><Search className="w-3 h-3 text-rose-800 shrink-0" /> <span className="truncate">Dictionary / Phonetic</span></div>
                                <div className="font-body text-stone-300">
                                    <div className="text-lg md:text-xl text-rose-500 font-bold mb-1 flex items-center gap-2 md:gap-3 flex-wrap break-words">{result.pinyin}<button onClick={(e) => { e.stopPropagation(); handleSpeak(analysisText); }} className="text-stone-600 hover:text-rose-400 p-1"><Volume2 className="w-4 h-4" /></button></div>
                                    <div className="text-xs md:text-sm italic text-stone-400 break-words">{result.def || result.meaning}</div>
                                </div>
                            </div>
                            
                            {/* BRIDGE INJECTION BUTTON */}
                            <div className="pt-2">
                                 <button 
                                    onClick={() => {
                                        injectIntoPAIN(analysisText, result, contextSentence, contextTranslation);
                                    }}
                                    disabled={isProcessing}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-rose-950/40 hover:bg-rose-900 border border-rose-900 text-rose-300 hover:text-white rounded-sm transition-all font-body text-[10px] md:text-xs uppercase tracking-widest shadow-sm"
                                 >
                                     {isProcessing ? <Zap className="w-4 h-4 animate-pulse shrink-0" /> : <BrainCircuit className="w-4 h-4 shrink-0" />}
                                     <span className="truncate">{isProcessing ? "Injecting..." : "Inject into PAIN Engine"}</span>
                                 </button>
                                 <p className="text-[8px] md:text-[9px] font-body text-stone-600 text-center mt-2 px-2">Captures current sentence context for cloze drills.</p>
                            </div>
                            <div className="border-t border-stone-800 pt-4">
                                <div className="text-[9px] uppercase tracking-widest text-stone-600 mb-2">Segmentation Override</div>
                                <textarea value={segmentationDraft} onChange={e => setSegmentationDraft(e.target.value)} className="w-full h-20 bg-black/50 border border-stone-800 text-stone-300 p-2 rounded-sm text-sm resize-y" placeholder="Separate words with spaces" />
                                <button onClick={saveSegmentationDraft} className="mt-2 px-3 py-1 bg-stone-900 border border-stone-800 text-stone-300 text-[10px] uppercase tracking-widest rounded-sm">Save Segmentation</button>
                            </div>
                            <div className="border-t border-stone-800 pt-4">
                                <div className="text-[9px] uppercase tracking-widest text-stone-600 mb-2">Sentence Annotation</div>
                                <textarea value={annotationDraft} onChange={e => setAnnotationDraft(e.target.value)} className="w-full h-20 bg-black/50 border border-stone-800 text-stone-300 p-2 rounded-sm text-sm resize-y" placeholder="Grammar, context, memory hook..." />
                                <button onClick={saveAnnotationDraft} className="mt-2 px-3 py-1 bg-stone-900 border border-stone-800 text-stone-300 text-[10px] uppercase tracking-widest rounded-sm">Save Annotation</button>
                            </div>
                        </div>
                      );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* --- READER: INGESTION MODAL --- */}
          {showPasteModal && currentAppView === 'reader' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300 p-2 md:p-4">
               <div className="relative w-full max-w-3xl bg-zinc-950 border border-stone-800 shadow-2xl p-4 md:p-8 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar rounded-sm">
                  <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0"><h3 className="font-heading text-2xl md:text-3xl text-stone-100 italic">Scribe's Input</h3><button onClick={() => setShowPasteModal(false)} className="text-stone-500 hover:text-rose-500 p-1"><X className="w-5 h-5 md:w-6 md:h-6"/></button></div>
                  <div className="flex flex-wrap gap-2 md:gap-4 mb-4 md:mb-6 border-b border-stone-800 pb-2 shrink-0">
                      <button onClick={() => setIngestTab('standard')} className={`flex items-center justify-center gap-1 md:gap-2 pb-2 text-[10px] md:text-xs font-body uppercase tracking-widest transition-colors flex-1 sm:flex-none ${ingestTab === 'standard' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-stone-600 hover:text-stone-400'}`}><Clipboard className="w-3 h-3 md:w-4 md:h-4 shrink-0" /> <span className="truncate">Raw Text / TSV</span></button>
                      <button onClick={() => setIngestTab('align')} className={`flex items-center justify-center gap-1 md:gap-2 pb-2 text-[10px] md:text-xs font-body uppercase tracking-widest transition-colors flex-1 sm:flex-none ${ingestTab === 'align' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-stone-600 hover:text-stone-400'}`}><Split className="w-3 h-3 md:w-4 md:h-4 shrink-0" /> <span className="truncate">Parallel Align</span></button>
                  </div>
                  {ingestTab === 'standard' && (
                      <div className="flex flex-col min-h-0 flex-grow">
                        <input type="text" value={importTitle} onChange={(e) => setImportTitle(e.target.value)} placeholder="Manuscript Title..." className="w-full bg-black/40 border border-stone-800 rounded-sm p-3 text-stone-200 font-heading text-lg md:text-xl focus:border-rose-900 outline-none mb-4 shrink-0"/>
                        <textarea value={pasteContent} onChange={(e) => setPasteContent(e.target.value)} placeholder="Paste pure Chinese text (or SC [TAB] TC [TAB] EN)..." className="w-full min-h-[200px] h-64 bg-black/40 border border-stone-800 rounded-sm p-3 md:p-4 text-stone-300 font-cn text-base md:text-lg outline-none mb-4 md:mb-6 custom-scrollbar resize-y"/>
                      </div>
                  )}
                  {ingestTab === 'align' && (
                      <div className="flex flex-col min-h-0 flex-grow">
                        <input type="text" value={importTitle} onChange={(e) => setImportTitle(e.target.value)} placeholder="Manuscript Title..." className="w-full bg-black/40 border border-stone-800 rounded-sm p-3 text-stone-200 font-heading text-lg md:text-xl focus:border-rose-900 outline-none mb-4 shrink-0"/>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 md:mb-6 flex-grow min-h-[200px]">
                            <textarea value={alignSource} onChange={(e) => setAlignSource(e.target.value)} placeholder="Source (Chinese)..." className="w-full h-full min-h-[150px] bg-black/40 border border-stone-800 rounded-sm p-3 md:p-4 text-stone-300 font-cn text-base md:text-lg outline-none custom-scrollbar resize-y"/>
                            <textarea value={alignTarget} onChange={(e) => setAlignTarget(e.target.value)} placeholder="Reference (English)..." className="w-full h-full min-h-[150px] bg-black/40 border border-stone-800 rounded-sm p-3 md:p-4 text-stone-400 font-body text-base md:text-lg outline-none custom-scrollbar resize-y"/>
                        </div>
                      </div>
                  )}
                  {manuscriptPreview && (
                      <div className="border border-rose-900/40 bg-rose-950/20 p-3 rounded-sm mb-4">
                          <div className="text-[10px] uppercase tracking-widest text-rose-500 mb-2">Preview before inscription</div>
                          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                              <div><span className="text-stone-600">Mode</span><div className="text-stone-300">{manuscriptPreview.mode}</div></div>
                              <div><span className="text-stone-600">Rows</span><div className="text-stone-300">{manuscriptPreview.rows}</div></div>
                              <div><span className="text-stone-600">Title</span><div className="text-stone-300 truncate">{manuscriptPreview.title}</div></div>
                          </div>
                          <div className="space-y-1">{manuscriptPreview.samples.map((sample, index) => <div key={index} className="text-xs text-stone-500 truncate">{sample}</div>)}</div>
                      </div>
                  )}
                  <div className="flex justify-end gap-3 md:gap-4 mt-2 md:mt-6 shrink-0">
                      <button onClick={() => { setManuscriptPreview(null); setShowPasteModal(false); }} className="px-4 md:px-6 py-2 border border-stone-800 text-stone-500 font-body text-[10px] md:text-xs uppercase tracking-widest hover:text-stone-300 rounded-sm">Discard</button>
                      <button onClick={handlePasteSubmit} className="px-4 md:px-6 py-2 bg-rose-900/20 border border-rose-900/50 text-rose-500 font-body text-[10px] md:text-xs uppercase tracking-widest hover:bg-rose-900/40 hover:text-rose-400 rounded-sm">{manuscriptPreview ? 'Confirm Import' : 'Preview'}</button>
                  </div>
               </div>
            </div>
          )}

          {/* --- READER: SENTENCE STUDY --- */}
          {showSentenceStudy && activeManuscript && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-950 border border-stone-800 rounded-sm shadow-2xl w-full max-w-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-heading text-2xl text-stone-100 italic">Sentence Study</h3>
                        <button onClick={() => setShowSentenceStudy(false)} className="text-stone-500 hover:text-rose-500"><X className="w-5 h-5" /></button>
                    </div>
                    {activeManuscript.content?.length > 0 && (
                        <div className="text-center">
                            <div className="text-[10px] uppercase tracking-widest text-stone-600 mb-4">{sentenceIndex + 1} / {activeManuscript.content.length}</div>
                            <div className="font-cn text-3xl text-stone-100 leading-loose mb-6">{activeManuscript.content[sentenceIndex]?.sc}</div>
                            {sentenceFlipped && <div className="text-xl text-stone-400 italic mb-6">{activeManuscript.content[sentenceIndex]?.en || 'No translation available.'}</div>}
                            <div className="flex justify-center gap-3">
                                <button onClick={() => setSentenceFlipped(prev => !prev)} className="px-4 py-2 border border-rose-900 text-rose-400 rounded-sm text-[10px] uppercase tracking-widest">Reveal</button>
                                <button onClick={() => handleSpeak(activeManuscript.content[sentenceIndex]?.sc)} className="px-4 py-2 border border-stone-800 text-stone-400 rounded-sm text-[10px] uppercase tracking-widest">Speak</button>
                                <button onClick={() => { setSentenceIndex(prev => (prev + 1) % activeManuscript.content.length); setSentenceFlipped(false); }} className="px-4 py-2 bg-stone-900 border border-stone-800 text-stone-300 rounded-sm text-[10px] uppercase tracking-widest">Next</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* --- PAIN: RELATION GRAPH --- */}
          {showRelationGraph && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-950 border border-stone-800 rounded-sm shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-heading text-2xl text-stone-100 italic">Semantic Relation Graph</h3>
                        <button onClick={() => setShowRelationGraph(false)} className="text-stone-500 hover:text-rose-500"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="text-sm text-stone-500 mb-4">Seed: <span className="font-cn text-stone-200">{activePainCard?.hanzi || cards[0]?.hanzi || 'No card'}</span></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {relationGraph.map(({ card, score }) => (
                            <div key={card.id} className="border border-stone-800 bg-black/40 p-3 rounded-sm">
                                <div className="flex justify-between"><span className="font-cn text-2xl text-stone-100">{card.hanzi}</span><span className="text-[10px] text-rose-500 uppercase tracking-widest">Score {score}</span></div>
                                <div className="text-xs text-stone-500">{card.category}</div>
                                <div className="text-sm text-stone-400 italic line-clamp-2">{card.meaning}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}

          {/* --- PAIN: DATA AUDIT --- */}
          {showDataAudit && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-950 border border-stone-800 rounded-sm shadow-2xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-heading text-2xl text-stone-100 italic">Data Quality Audit</h3>
                        <button onClick={() => setShowDataAudit(false)} className="text-stone-500 hover:text-rose-500"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            ['Missing Pinyin', dataAudit.missingPinyin],
                            ['Missing Example', dataAudit.missingExample],
                            ['Missing Distractors', dataAudit.missingDistractors],
                            ['Missing Chinese Definition', dataAudit.missingDefinition],
                            ['Missing Tags', dataAudit.missingTags]
                        ].map(([label, list]) => (
                            <div key={label} className="border border-stone-800 bg-black/40 p-3 rounded-sm">
                                <div className="flex justify-between mb-2"><span className="text-[10px] uppercase tracking-widest text-stone-500">{label}</span><span className="text-rose-500">{list.length}</span></div>
                                <div className="flex flex-wrap gap-1">{list.slice(0, 12).map(card => <button key={card.id} onClick={() => setEditingCard({ ...card, tags: (card.tags || []).join(', ') })} className="px-2 py-1 border border-stone-800 rounded-sm font-cn text-stone-300">{card.hanzi}</button>)}</div>
                            </div>
                        ))}
                        <div className="md:col-span-2 border border-stone-800 bg-black/40 p-3 rounded-sm">
                            <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-2">Duplicate Merge</div>
                            {dataAudit.duplicates.length === 0 ? <div className="text-stone-600 italic">No duplicate Hanzi entries found.</div> : dataAudit.duplicates.map(([term, group]) => (
                                <div key={term} className="flex items-center justify-between border-t border-stone-900 py-2">
                                    <span className="font-cn text-stone-200">{term} <span className="font-body text-stone-600">({group.length})</span></span>
                                    <button onClick={() => mergeDuplicateGroup(term)} className="px-3 py-1 border border-rose-900 text-rose-400 rounded-sm text-[10px] uppercase tracking-widest">Merge</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* --- SYNC SETTINGS --- */}
          {showSyncSettings && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-950 border border-stone-800 rounded-sm shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-heading text-2xl text-stone-100 italic">Sync Settings</h3>
                        <button onClick={() => setShowSyncSettings(false)} className="text-stone-500 hover:text-rose-500"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="border border-stone-800 bg-black/40 p-3 rounded-sm"><span className="text-stone-600">Mode:</span> <span className={user ? 'text-emerald-400' : 'text-amber-200'}>{user ? 'Cloud sync active' : 'Local archive mode'}</span></div>
                        <div className="border border-stone-800 bg-black/40 p-3 rounded-sm"><span className="text-stone-600">App ID:</span> <span className="text-stone-300">{appId}</span></div>
                        <div className="border border-stone-800 bg-black/40 p-3 rounded-sm"><span className="text-stone-600">Archive:</span> <span className="text-stone-300 break-all">{cloudArchiveId}</span></div>
                        <div className="border border-stone-800 bg-black/40 p-3 rounded-sm"><span className="text-stone-600">Signed-in UID:</span> <span className="text-stone-300 break-all">{user?.uid || 'Not signed in'}</span></div>
                        <div className="border border-stone-800 bg-black/40 p-3 rounded-sm"><span className="text-stone-600">Firebase Config:</span> <span className="text-stone-300">{Object.keys(firebaseConfig || {}).length ? 'Provided' : 'Not provided'}</span></div>
                        <div className="border border-stone-800 bg-black/40 p-3 rounded-sm space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-stone-300 uppercase tracking-widest text-[10px]">Cloud Firebase Config</span>
                                <span className={user ? "text-emerald-400 text-[10px] uppercase tracking-widest" : "text-stone-600 text-[10px] uppercase tracking-widest"}>{user ? "Live" : "Not Connected"}</span>
                            </div>
                            <textarea value={cloudConfigDraft} onChange={e => setCloudConfigDraft(e.target.value)} spellCheck={false} className="w-full h-32 bg-black/60 border border-stone-800 text-stone-300 p-3 rounded-sm font-mono text-xs outline-none focus:border-rose-900 custom-scrollbar resize-y" placeholder='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}' />
                            <div className="flex flex-wrap gap-2">
                                <button onClick={handleSaveCloudConfig} className="px-3 py-2 border border-emerald-900 bg-emerald-950/20 text-emerald-400 rounded-sm text-[10px] uppercase tracking-widest">Save and Reload</button>
                                <button onClick={handleClearCloudConfig} className="px-3 py-2 border border-stone-800 bg-stone-900 text-stone-400 rounded-sm text-[10px] uppercase tracking-widest">Return to Local</button>
                                <button onClick={runCloudDiagnostic} disabled={isProcessing || !user} className="px-3 py-2 border border-emerald-900 bg-emerald-950/20 text-emerald-400 rounded-sm text-[10px] uppercase tracking-widest disabled:opacity-40">Test Cloud Write</button>
                                <button onClick={pushLocalDataToCloud} disabled={isProcessing} className="px-3 py-2 border border-blue-900 bg-blue-950/30 text-blue-400 rounded-sm text-[10px] uppercase tracking-widest disabled:opacity-40">Push Local Archive</button>
                            </div>
                            {syncStatus && <p className="text-stone-400 text-xs">{syncStatus}</p>}
                        </div>
                        <p className="text-stone-500 italic">Local mode stores data in this browser. With Firebase active, manuscripts, reader annotations, segmentation edits, cards, dictionary entries, and activity sync live through Firestore.</p>
                    </div>
                </div>
            </div>
          )}

          {/* --- PAIN: CARD BROWSER --- */}
          {showCardBrowser && currentAppView === 'pain' && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
                <div className="bg-zinc-950 rounded-sm w-full max-w-5xl p-4 md:p-6 shadow-2xl border border-stone-800 max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h3 className="text-xl md:text-2xl font-bold text-stone-200 font-heading tracking-widest italic">PAIN Card Browser</h3>
                        <button onClick={() => setShowCardBrowser(false)} className="text-stone-500 hover:text-stone-300 p-1"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <input value={cardSearch} onChange={e => setCardSearch(e.target.value)} placeholder="Search cards, tags, pinyin..." className="bg-black/50 border border-stone-800 text-stone-200 px-3 py-2 rounded-sm outline-none" />
                        <select value={cardFilter} onChange={e => setCardFilter(e.target.value)} className="bg-black/50 border border-stone-800 text-stone-200 px-3 py-2 rounded-sm outline-none">
                            <option value="due">Due today</option>
                            <option value="all">All cards</option>
                            <option value="weak">Weak</option>
                            <option value="new">New</option>
                            <option value="mastered">Mastered</option>
                            <option value="missing">Missing data</option>
                        </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-4 text-[10px] uppercase tracking-widest">
                        <button onClick={() => setSelectedCardIds(prev => prev.size === browserCards.length ? new Set() : new Set(browserCards.map(card => card.id)))} className="px-3 py-2 border border-stone-800 bg-stone-900 text-stone-300 rounded-sm">
                            {selectedCardIds.size === browserCards.length && browserCards.length > 0 ? 'Deselect visible' : 'Select visible'}
                        </button>
                        <button onClick={() => updateKnownStatus(Array.from(selectedCardIds), true)} disabled={selectedCardIds.size === 0} className="px-3 py-2 border border-blue-900 bg-blue-950/30 text-blue-400 rounded-sm disabled:opacity-40">Mark selected known</button>
                        <button onClick={() => updateKnownStatus(browserCards.map(card => card.id), true)} disabled={browserCards.length === 0} className="px-3 py-2 border border-emerald-900 bg-emerald-950/20 text-emerald-400 rounded-sm disabled:opacity-40">Mark filtered known</button>
                        <button onClick={() => updateKnownStatus(Array.from(selectedCardIds), false)} disabled={selectedCardIds.size === 0} className="px-3 py-2 border border-rose-900 bg-rose-950/20 text-rose-400 rounded-sm disabled:opacity-40">Reactivate selected</button>
                        <span className="text-stone-600 ml-auto">{selectedCardIds.size} selected</span>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar border border-stone-900 bg-black/30 p-2 flex-1">
                        {browserCards.length === 0 ? (
                            <div className="text-stone-600 italic text-center py-10">No cards match this view.</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {browserCards.map(card => (
                                    <div key={card.id} className="border border-stone-800 bg-stone-900/40 p-3 rounded-sm">
                                        <div className="flex justify-between gap-3">
                                            <div className="flex gap-2 min-w-0">
                                                <input type="checkbox" checked={selectedCardIds.has(card.id)} onChange={e => setSelectedCardIds(prev => { const next = new Set(prev); if (e.target.checked) next.add(card.id); else next.delete(card.id); return next; })} className="mt-1 shrink-0" />
                                                <div className="min-w-0">
                                                    <div className="font-cn text-2xl text-stone-100 truncate">{card.hanzi}</div>
                                                    <div className="text-rose-500 text-xs truncate">{card.pinyin}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => updateKnownStatus(card.id, !card.isMastered)} className={card.isMastered ? "text-emerald-400 hover:text-rose-400 p-1" : "text-stone-500 hover:text-blue-400 p-1"} title={card.isMastered ? "Reactivate for review" : "Mark known"}><Trophy className="w-4 h-4" /></button>
                                                <button onClick={() => setEditingCard({ ...card, tags: (card.tags || []).join(', ') })} className="text-stone-500 hover:text-emerald-400 p-1"><Feather className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-stone-400 italic line-clamp-2 mt-1">{card.meaning}</p>
                                        <div className="flex flex-wrap gap-1 mt-2 text-[9px] uppercase tracking-widest">
                                            <span className="border border-stone-700 text-stone-500 px-1 rounded-sm">Due {card.dueDate || todayKey()}</span>
                                            <span className="border border-stone-700 text-stone-500 px-1 rounded-sm">Ease {(card.ease || 2.5).toFixed(2)}</span>
                                            {card.isMastered && <span className="border border-blue-900 text-blue-400 px-1 rounded-sm">Known</span>}
                                            {(card.tags || []).map(tag => <span key={tag} className="border border-rose-900/50 text-rose-400 px-1 rounded-sm">{tag}</span>)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
          )}

          {/* --- PAIN: EDIT CARD MODAL --- */}
          {editingCard && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
                <div className="bg-zinc-950 rounded-sm w-full max-w-2xl p-4 md:p-6 shadow-2xl border border-stone-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl md:text-2xl font-bold text-stone-200 font-heading tracking-widest italic">Edit Synapse</h3>
                        <button onClick={() => setEditingCard(null)} className="text-stone-500 hover:text-stone-300 p-1"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            ['hanzi', 'Hanzi'], ['pinyin', 'Pinyin'], ['meaning', 'Meaning'], ['category', 'Category'],
                            ['tags', 'Tags'], ['register', 'Register'], ['clozeTarget', 'Cloze Target'], ['example', 'Example'], ['example_meaning', 'Translation'],
                            ['distractors', 'Distractors'], ['nuance_tip', 'Nuance Tip'], ['definition_cn', 'Monolingual Def'], ['notes', 'Notes']
                        ].map(([key, label]) => (
                            <label key={key} className={['example','example_meaning','distractors','nuance_tip','definition_cn','notes'].includes(key) ? 'sm:col-span-2' : ''}>
                                <span className="block text-[9px] uppercase tracking-widest text-stone-500 mb-1">{label}</span>
                                <textarea value={editingCard[key] || ''} onChange={e => setEditingCard(prev => ({ ...prev, [key]: e.target.value }))} className="w-full min-h-[42px] bg-black/50 border border-stone-800 text-stone-200 px-3 py-2 rounded-sm outline-none resize-y" />
                            </label>
                        ))}
                        <label>
                            <span className="block text-[9px] uppercase tracking-widest text-stone-500 mb-1">Due Date</span>
                            <input type="date" value={editingCard.dueDate || todayKey()} onChange={e => setEditingCard(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full bg-black/50 border border-stone-800 text-stone-200 px-3 py-2 rounded-sm outline-none" />
                        </label>
                        <label>
                            <span className="block text-[9px] uppercase tracking-widest text-stone-500 mb-1">Ease</span>
                            <input type="number" step="0.05" min="1.3" max="3.5" value={editingCard.ease || 2.5} onChange={e => setEditingCard(prev => ({ ...prev, ease: Number(e.target.value) }))} className="w-full bg-black/50 border border-stone-800 text-stone-200 px-3 py-2 rounded-sm outline-none" />
                        </label>
                        {[
                            ['mastery_recognition', 'Recognition'],
                            ['mastery_production', 'Production'],
                            ['mastery_cloze', 'Cloze'],
                            ['mastery_nuance', 'Nuance'],
                            ['mastery_mono', 'Monolingual']
                        ].map(([key, label]) => (
                            <label key={key}>
                                <span className="block text-[9px] uppercase tracking-widest text-stone-500 mb-1">{label} Mastery</span>
                                <input type="number" min="0" max="100" value={editingCard[key] || 0} onChange={e => setEditingCard(prev => ({ ...prev, [key]: Number(e.target.value) }))} className="w-full bg-black/50 border border-stone-800 text-stone-200 px-3 py-2 rounded-sm outline-none" />
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end gap-3 mt-5">
                        <button onClick={() => setEditingCard(null)} className="px-4 py-2 border border-stone-800 text-stone-500 text-[10px] uppercase tracking-widest rounded-sm">Cancel</button>
                        <button onClick={saveEditedCard} className="px-4 py-2 bg-rose-900/40 border border-rose-900 text-rose-300 text-[10px] uppercase tracking-widest rounded-sm">Save Card</button>
                    </div>
                </div>
            </div>
          )}

          {/* --- PAIN: ADD CARD MODAL --- */}
          {showAddCardModal && currentAppView === 'pain' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
                <div className="bg-zinc-950 rounded-sm w-full max-w-md p-4 md:p-6 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar border border-stone-800">
                    <div className="flex justify-between items-center mb-4 md:mb-6"><h3 className="text-xl md:text-2xl font-bold text-stone-200 font-heading tracking-widest italic">New Synapse</h3><button onClick={() => setShowAddCardModal(false)} className="text-stone-500 hover:text-stone-300 p-1"><X className="w-5 h-5" /></button></div>
                    <form onSubmit={handleAddCard} className="space-y-3 md:space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            <div><label className="block text-[9px] md:text-[10px] font-body text-stone-500 uppercase mb-1">Hanzi</label><input required placeholder="Hanzi" value={newCard.hanzi} onChange={e => setNewCard({...newCard, hanzi: e.target.value})} className="w-full rounded-sm bg-black/50 border border-stone-800 text-stone-200 focus:border-rose-900 font-cn px-2 py-1.5 md:py-1 outline-none" /></div>
                             <div><label className="block text-[9px] md:text-[10px] font-body text-stone-500 uppercase mb-1">Category</label><input placeholder="Category" value={newCard.category} onChange={e => setNewCard({...newCard, category: e.target.value})} className="w-full rounded-sm bg-black/50 border border-stone-800 text-stone-200 focus:border-rose-900 font-body px-2 py-1.5 md:py-1 outline-none" /></div>
                        </div>
                        <div><label className="block text-[9px] md:text-[10px] font-body text-stone-500 uppercase mb-1">Pinyin</label><input required placeholder="Pinyin" value={newCard.pinyin} onChange={e => setNewCard({...newCard, pinyin: e.target.value})} className="w-full rounded-sm bg-black/50 border border-stone-800 text-stone-200 focus:border-rose-900 font-body px-2 py-1.5 md:py-1 outline-none" /></div>
                        <div><label className="block text-[9px] md:text-[10px] font-body text-stone-500 uppercase mb-1">Meaning</label><input required placeholder="Meaning" value={newCard.meaning} onChange={e => setNewCard({...newCard, meaning: e.target.value})} className="w-full rounded-sm bg-black/50 border border-stone-800 text-stone-200 focus:border-rose-900 font-body px-2 py-1.5 md:py-1 outline-none" /></div>
                        <div><label className="block text-[9px] md:text-[10px] font-body text-stone-500 uppercase mb-1">Tags</label><input value={newCard.tags} onChange={e => setNewCard({...newCard, tags: e.target.value})} placeholder="HSK, literary, weak" className="w-full rounded-sm bg-black/50 border border-stone-800 text-stone-200 focus:border-rose-900 font-body px-2 py-1.5 md:py-1 outline-none" /></div>
                        <div><label className="block text-[9px] md:text-[10px] font-body text-stone-500 uppercase mb-1">Example Sentence</label><input placeholder="Example sentence" value={newCard.example} onChange={e => setNewCard({...newCard, example: e.target.value})} className="w-full rounded-sm bg-black/50 border border-stone-800 text-stone-200 focus:border-rose-900 font-cn px-2 py-1.5 md:py-1 outline-none" /></div>
                        <div><label className="block text-[9px] md:text-[10px] font-body text-stone-500 uppercase mb-1">Translation</label><input placeholder="Translation" value={newCard.example_meaning} onChange={e => setNewCard({...newCard, example_meaning: e.target.value})} className="w-full rounded-sm bg-black/50 border border-stone-800 text-stone-200 focus:border-rose-900 font-body px-2 py-1.5 md:py-1 outline-none" /></div>
                        <div><label className="block text-[9px] md:text-[10px] font-body text-stone-500 uppercase mb-1">Notes</label><input placeholder="Notes" value={newCard.notes} onChange={e => setNewCard({...newCard, notes: e.target.value})} className="w-full rounded-sm bg-black/50 border border-stone-800 text-stone-200 focus:border-rose-900 font-body px-2 py-1.5 md:py-1 outline-none" /></div>
                        <button type="submit" className="w-full bg-rose-900/40 text-rose-300 border border-rose-900 py-2.5 md:py-2 rounded-sm font-body text-[10px] md:text-xs uppercase tracking-widest hover:bg-rose-800 hover:text-white transition-colors flex items-center justify-center gap-2 mt-2 md:mt-4"><Save className="w-4 h-4" /> Inject</button>
                    </form>
                </div>
            </div>
          )}

          {/* --- PAIN: IMPORT JSON/TSV MODAL (WITH BASE KNOWLEDGE ASSIMILATION) --- */}
          {showPainImportModal && currentAppView === 'pain' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
                <div className="bg-zinc-950 rounded-sm w-full max-w-lg p-4 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-200 border border-stone-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                     <div className="flex justify-between items-center mb-4 md:mb-6"><h3 className="text-xl md:text-2xl font-bold text-stone-200 font-heading tracking-widest italic">Bulk Import PAIN Set</h3><button onClick={closePainImportModal} className="text-stone-500 hover:text-stone-300 p-1 disabled:opacity-40" disabled={isProcessing} title={isProcessing ? 'Import is running' : 'Close'}><X className="w-5 h-5" /></button></div>
                     <div className="flex justify-end mb-4 md:mb-6">
                        <button onClick={handleClearDatabase} className="flex items-center gap-1 md:gap-2 bg-red-950/30 text-red-400 px-2 md:px-3 py-1.5 rounded-sm hover:bg-red-900 hover:text-red-100 transition-colors text-[10px] md:text-xs border border-red-900/50 font-body uppercase tracking-wide"><AlertTriangle className="w-3 h-3" />Purge Queue</button>
                     </div>
                    <div className="mb-4 md:mb-6 flex flex-col gap-2">
                         <p className="text-[9px] md:text-[10px] text-stone-400 font-body uppercase tracking-widest">Option A: Upload TSV/CSV/JSON</p>
                         <div className="flex gap-2">
                             <input type="file" accept=".csv,.json,.tsv,.txt" ref={painFileInputRef} onChange={(e) => { const f = e.target.files[0]; if(!f)return; const r = new FileReader(); r.onload = ev => setPainImportInput(ev.target.result); r.readAsText(f); e.target.value = null; }} className="hidden" />
                             <button onClick={() => painFileInputRef.current?.click()} className="flex items-center gap-2 bg-stone-900 text-stone-300 px-3 md:px-4 py-2 rounded-sm hover:bg-stone-800 transition-colors text-[9px] md:text-[10px] uppercase tracking-widest border border-stone-800 font-body w-full sm:w-auto justify-center"><Upload className="w-3 h-3 md:w-4 md:h-4" />Select File</button>
                         </div>
                    </div>
                    <p className="text-[9px] md:text-[10px] text-stone-400 mb-1 md:mb-2 font-body uppercase tracking-widest">Option B: Paste Raw Data</p>
                    <textarea value={painImportInput} onChange={e => setPainImportInput(e.target.value)} className="w-full h-24 md:h-32 rounded-sm bg-black/50 border border-stone-800 font-body text-[10px] md:text-xs text-stone-400 focus:border-rose-900 mb-2 p-2 md:p-3 outline-none custom-scrollbar resize-y" placeholder="Hanzi | Pinyin | Meaning | Cat | Notes | Ex | ExTrans" />
                    {painImportAnalysis && (
                        <div className="mb-3 border border-stone-800 bg-black/40 rounded-sm p-3">
                            <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest font-body mb-2">
                                <span className="text-stone-400">Rows: {painImportAnalysis.total}</span>
                                <span className="text-emerald-500">Valid: {painImportAnalysis.valid.length}</span>
                                <span className={painImportAnalysis.issues.length ? 'text-red-400' : 'text-stone-600'}>Issues: {painImportAnalysis.issues.length}</span>
                            </div>
                            {painImportAnalysis.valid.slice(0, 3).length > 0 && (
                                <div className="grid grid-cols-1 gap-1 mb-2">
                                    {painImportAnalysis.valid.slice(0, 3).map(item => <div key={item.id || item.hanzi} className="text-xs text-stone-400 truncate"><span className="font-cn text-stone-200">{item.hanzi}</span> - {item.meaning}</div>)}
                                </div>
                            )}
                            {painImportAnalysis.issues.slice(0, 3).map(issue => (
                                <div key={`${issue.index}-${issue.term}`} className="text-[10px] text-red-400 font-body">Row {issue.index}: {issue.term} - {issue.issues.join(', ')}</div>
                            ))}
                        </div>
                    )}
                    {painImportError && <p className="text-red-500 text-xs md:text-sm mb-3 font-body italic">{painImportError}</p>}
                    {importProgress?.scope === 'pain-import' && (
                        <div className="mb-3 border border-rose-900/50 bg-black/60 rounded-sm p-3 shadow-inner">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Zap className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
                                    <span className="text-[10px] md:text-xs text-stone-200 uppercase tracking-widest truncate">{importProgress.label}</span>
                                </div>
                                <span className="text-[10px] md:text-xs text-stone-400 whitespace-nowrap">
                                    {importProgress.total ? `${importProgress.current} / ${importProgress.total}` : 'Working'}
                                </span>
                            </div>
                            {importProgress.total > 0 && (
                                <div className="h-2 bg-stone-900 border border-stone-800 rounded-sm overflow-hidden">
                                    <div
                                        className="h-full bg-rose-700 transition-all"
                                        style={{ width: `${Math.max(4, Math.min(100, Math.round((importProgress.current / importProgress.total) * 100)))}%` }}
                                    />
                                </div>
                            )}
                            {syncStatus && <p className="text-[10px] text-stone-500 mt-2 break-words">{syncStatus}</p>}
                        </div>
                    )}
                    <div className="flex justify-end mt-2 md:mt-4 mb-6 md:mb-8 border-b border-stone-800 pb-6 md:pb-8">
                        <button onClick={handlePainImportData} disabled={isProcessing || !painImportAnalysis?.valid?.length} className="bg-rose-900/40 text-rose-300 border border-rose-900 px-4 md:px-6 py-2 rounded-sm text-[10px] md:text-xs font-body uppercase tracking-widest hover:bg-rose-800 hover:text-white transition-colors w-full sm:w-auto disabled:opacity-40">{isProcessing ? 'Ingesting...' : `Ingest ${painImportAnalysis?.valid?.length || 0} Valid Rows`}</button>
                    </div>

                    <div className="flex flex-col gap-2">
                         <p className="text-[9px] md:text-[10px] text-emerald-600/80 font-body uppercase tracking-widest font-bold">Option C: Assimilate Base Lexicon (HSK 1-6)</p>
                         <p className="text-[10px] text-stone-500 font-body italic mb-1 md:mb-2">Uploads 11-column PAIN TSV directly into both the Reader Glossary and the PAIN Engine queue. Automatically chunks large datasets.</p>
                         <div className="flex gap-2">
                             <input type="file" accept=".csv,.json,.tsv,.txt" ref={baseKnowledgeInputRef} onChange={handleBaseKnowledgeUpload} className="hidden" />
                             <button onClick={() => baseKnowledgeInputRef.current?.click()} disabled={isProcessing} className="flex items-center gap-2 bg-emerald-950/20 text-emerald-500 px-3 md:px-4 py-2 rounded-sm hover:bg-emerald-900/40 hover:text-emerald-400 transition-colors text-[9px] md:text-[10px] uppercase tracking-widest border border-emerald-900/30 font-body w-full justify-center">
                                 {isProcessing ? <Zap className="w-3 h-3 md:w-4 md:h-4 animate-pulse" /> : <Database className="w-3 h-3 md:w-4 md:h-4" />} 
                                 <span className="truncate">{isProcessing ? 'Assimilating Base Data...' : 'Upload Massive HSK Schema'}</span>
                             </button>
                         </div>
                    </div>
                </div>
            </div>
          )}

      </div>
    </div>
  );
};

export default App;
