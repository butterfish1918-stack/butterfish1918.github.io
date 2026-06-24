const fs = require('fs');
const vm = require('vm');

const babelCode = fs.readFileSync('vendor/babel.min.js', 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(babelCode, ctx);

const iconNames = [
  'Skull','Scroll','Feather','ArrowRightLeft','Download','Upload','X','Search','Globe','ChevronRight',
  'Sparkles','Flame','Clipboard','Languages','Zap','BookOpen','ChevronLeft','Plus','Volume2','Split',
  'AlignJustify','Database','Network','Trash2','Library','AlertCircle','Eye','EyeOff',
  'VolumeX','Save','RotateCcw','CheckCircle','XCircle','Quote','Keyboard','Activity','FileSpreadsheet',
  'SkipForward','Trophy','Award','AlertTriangle','BrainCircuit','Ghost','Moon','Scale','RefreshCw','Filter','Info'
];

let source = fs.readFileSync('src/App.jsx', 'utf8');
source = source
  .replace(/import\s+React,\s*\{([^}]*)\}\s+from\s+['"]react['"];\s*/g, 'const { $1 } = React;\n')
  .replace(/import\s+\{[\s\S]*?\}\s+from\s+['"]lucide-react['"];\s*/g, iconNames.map(name => `const ${name} = window.__icons.${name};`).join('\n') + '\n')
  .replace(/import\s+\{\s*initializeApp\s*\}\s+from\s+['"]firebase\/app['"];\s*/g, '')
  .replace(/import\s+\{[\s\S]*?\}\s+from\s+['"]firebase\/auth['"];\s*/g, '')
  .replace(/import\s+\{[\s\S]*?\}\s+from\s+['"]firebase\/firestore['"];\s*/g, '')
  .replace(/export\s+default\s+App\s*;?\s*$/m, '');

const firebaseMocks = `
const initializeApp = (config = {}) => ({ config });
const getAuth = () => ({});
const signInWithCustomToken = async () => ({ user: null });
const signInAnonymously = async () => ({ user: null });
const onAuthStateChanged = (_auth, callback) => {
  const id = window.setTimeout(() => callback(null), 0);
  return () => window.clearTimeout(id);
};
const getFirestore = () => ({});
const collection = (...path) => ({ path });
const doc = (...path) => ({ path });
const setDoc = async () => {};
const deleteDoc = async () => {};
const updateDoc = async () => {};
const getDocs = async () => ({ docs: [], forEach: () => {} });
const addDoc = async () => ({ id: String(Date.now()) });
const writeBatch = () => ({ set() {}, delete() {}, update() {}, commit: async () => {} });
const increment = (value) => value;
const onSnapshot = (_ref, callback) => {
  const id = window.setTimeout(() => callback({ docs: [], forEach: () => {} }), 0);
  return () => window.clearTimeout(id);
};
`;

const bootstrap = `${firebaseMocks}
${source}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));`;

const out = ctx.Babel.transform(bootstrap, {
  presets: [['react', { runtime: 'classic' }]],
  filename: 'App.offline.jsx',
  sourceType: 'script'
}).code;

console.log('compiled chars', out.length);
