
/**
 * Renders the expandable developer diagnostics console for AI requests.
 *
 * @param {object} props
 * @param {boolean} props.showDiag - Visibility flag
 * @param {Function} props.setShowDiag - Visibility toggle
 * @param {string[]} props.aiDiagnostics - List of diagnostic log messages
 * @returns {React.ReactNode} Rendered diagnostics drawer or null
 *
 * @example
 * <AiDiagnosticsDrawer showDiag={true} setShowDiag={fn} aiDiagnostics={['Probing...']} />
 *
 * @example
 * <AiDiagnosticsDrawer showDiag={false} setShowDiag={fn} aiDiagnostics={[]} />
 */
const AiDiagnosticsDrawer = ({ showDiag, setShowDiag, aiDiagnostics }) => {
    if (!showDiag || !aiDiagnostics || aiDiagnostics.length === 0) return null;
    return (
        <div className="p-3 bg-slate-900 text-slate-200 border-b border-slate-700 text-xs flex flex-col gap-1.5 shrink-0 max-h-56 overflow-y-auto font-mono">
            <div className="flex items-center justify-between font-bold text-amber-400 text-[11px]">
                <span>🐞 LIVE AI DIAGNOSTICS LOGS</span>
                <button onClick={() => setShowDiag(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            {aiDiagnostics.map((log, lIdx) => (
                <div key={lIdx} className="text-[10.5px] leading-snug border-b border-slate-800/80 pb-0.5 last:border-0">{log}</div>
            ))}
        </div>
    );
};
/**
 * API key password input and Save/Clear buttons for the AI Studio settings drawer.
 *
 * @param {object} props
 * @param {string} props.keyInput - Current text input state for key
 * @param {Function} props.setKeyInput - State setter for key input
 * @param {string} props.apiKey - Persisted API key
 * @param {Function} props.onSave - Callback when Save is clicked
 * @param {Function} props.onClear - Callback when Clear is clicked
 * @returns {React.ReactNode}
 *
 * @example
 *   <AiStudioKeyInputRow keyInput={k} setKeyInput={setK} apiKey="" onSave={save} onClear={clear} />
 *
 * @example
 *   <AiStudioKeyInputRow keyInput="AIza..." setKeyInput={() => {}} apiKey="AIza..." onSave={() => {}} onClear={() => {}} />
 */
const AiStudioKeyInputRow = ({ keyInput, setKeyInput, apiKey, onSave, onClear }) => (
    <div className="flex gap-1.5">
        <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="Paste API Key (AIzaSy...)"
            className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-blue-500 font-mono"
        />
        <button
            type="button"
            onClick={onSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer"
        >
            Save
        </button>
        {apiKey && (
            <button
                type="button"
                onClick={onClear}
                className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-medium px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer"
            >
                Clear
            </button>
        )}
    </div>
);

/**
 * Renders an individual radio option for choosing an AI engine override.
 *
 * @param {object} props
 * @param {string} props.value - Engine mode identifier ('gemini' or 'internal')
 * @param {string} props.label - Display text for the radio option
 * @param {boolean} props.checked - Whether this option is currently selected
 * @param {string} props.accentClass - Accent color Tailwind class for the radio input
 * @param {Function} props.onSelect - Callback invoked when radio option is chosen
 * @returns {React.ReactNode}
 *
 * @example
 * <AiEngineRadioOption value="gemini" label="Gemini 2.5 Flash" checked={true} accentClass="accent-emerald-600" onSelect={() => {}} />
 *
 * @example
 * <AiEngineRadioOption value="internal" label="Internal Engine" checked={false} accentClass="accent-blue-600" onSelect={() => {}} />
 */
const AiEngineRadioOption = ({ value, label, checked, accentClass, onSelect }) => (
    <label className="flex items-center gap-1 cursor-pointer text-slate-700 font-medium">
        <input
            type="radio"
            name="aiEngineSetting"
            value={value}
            checked={checked}
            onChange={() => onSelect && onSelect(value)}
            className={`${accentClass} cursor-pointer`}
        />
        <span>{label}</span>
    </label>
);

/**
 * Renders radio buttons for choosing the AI engine override ('gemini' vs 'internal').
 *
 * @param {Object} props
 * @param {string} props.aiEngine - Currently selected engine ('gemini' or 'internal')
 * @param {Function} props.handleSelectEngine - Callback when an engine option is selected
 * @returns {React.ReactElement}
 *
 * @example
 * <AiEngineRadioGroup aiEngine="gemini" handleSelectEngine={(eng) => console.log(eng)} />
 *
 * @example
 * <AiEngineRadioGroup aiEngine="internal" handleSelectEngine={() => {}} />
 */
const AiEngineRadioGroup = ({ aiEngine, handleSelectEngine }) => (
    <div className="flex items-center gap-2 pt-1 text-[11px]">
        <span className="text-slate-500 font-medium shrink-0">Engine Override:</span>
        <div className="flex items-center gap-2">
            <AiEngineRadioOption
                value="gemini"
                label="Gemini 2.5 Flash"
                checked={aiEngine === 'gemini'}
                accentClass="accent-emerald-600"
                onSelect={handleSelectEngine}
            />
            <AiEngineRadioOption
                value="internal"
                label="Internal Engine"
                checked={aiEngine === 'internal'}
                accentClass="accent-blue-600"
                onSelect={handleSelectEngine}
            />
        </div>
    </div>
);

/**
 * Renders the test connection button and live connection diagnostic status badge.
 *
 * @param {Object} props
 * @param {Function} props.handleTestConnection - Callback to trigger connectivity test
 * @param {Object|null} props.testStatus - Current connectivity test status object
 * @returns {React.ReactElement}
 *
 * @example
 * <AiConnectionProbeControls handleTestConnection={() => {}} testStatus={null} />
 *
 * @example
 * <AiConnectionProbeControls
 *   handleTestConnection={() => console.log('testing')}
 *   testStatus={{ ok: true, msg: 'Connected successfully' }}
 * />
 */
const AiConnectionProbeControls = ({ handleTestConnection, testStatus }) => (
    <div className="flex items-center justify-between pt-1">
        <button
            type="button"
            onClick={handleTestConnection}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
        >
            <span>🧪</span>
            <span>Test Connection</span>
        </button>
        {testStatus && (
            <span className={`text-[11px] font-semibold ${testStatus.ok ? 'text-emerald-600' : (testStatus.loading ? 'text-blue-600' : 'text-rose-600')}`}>
                {testStatus.msg}
            </span>
        )}
    </div>
);

/**
 * Dropdown selector for targeting the Google AI Studio environment.
 *
 * @param {object} props
 * @param {string} props.apiEnv - Target environment ('auto', 'preprod', 'prod')
 * @param {Function} props.setApiEnv - State setter for API environment
 * @returns {React.ReactNode}
 *
 * @example
 *   <AiEnvironmentSelect apiEnv="auto" setApiEnv={() => {}} />
 *
 * @example
 *   <AiEnvironmentSelect apiEnv="prod" setApiEnv={(env) => console.log(env)} />
 */
const AiEnvironmentSelect = ({ apiEnv, setApiEnv }) => (
    <div className="flex items-center gap-2 pt-0.5 text-[11px]">
        <span className="text-slate-500 font-medium shrink-0">Environment:</span>
        <select
            value={apiEnv}
            onChange={e => {
                setApiEnv(e.target.value);
                localStorage.setItem('familyTree_geminiEnv', e.target.value);
            }}
            className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs text-slate-700 outline-none focus:border-blue-500"
        >
            <option value="prod">Google AI Studio (aistudio.google.com)</option>
        </select>
    </div>
);

/**
 * Engine override radio buttons, environment selector, and connection test controls.
 *
 * @param {object} props
 * @param {string} props.aiEngine - Currently selected engine ('gemini' or 'internal')
 * @param {Function} props.handleSelectEngine - Callback when an engine option is selected
 * @param {string} props.apiEnv - Target environment ('auto', 'preprod', 'prod')
 * @param {Function} props.setApiEnv - State setter for API environment
 * @param {Function} props.handleTestConnection - Callback to trigger connectivity test
 * @param {object|null} props.testStatus - Current connectivity test status object
 * @returns {React.ReactNode}
 *
 * @example
 *   <AiStudioEnvironmentConfig aiEngine="gemini" handleSelectEngine={fn} apiEnv="auto" setApiEnv={fn} handleTestConnection={fn} testStatus={null} />
 *
 * @example
 *   <AiStudioEnvironmentConfig aiEngine="internal" handleSelectEngine={() => {}} apiEnv="prod" setApiEnv={() => {}} handleTestConnection={() => {}} testStatus={{ ok: true, msg: 'Connected' }} />
 */
const AiStudioEnvironmentConfig = ({
    aiEngine,
    handleSelectEngine,
    apiEnv,
    setApiEnv,
    handleTestConnection,
    testStatus
}) => (
    <>
        <AiEngineRadioGroup
            aiEngine={aiEngine}
            handleSelectEngine={handleSelectEngine}
        />
        <AiEnvironmentSelect apiEnv={apiEnv} setApiEnv={setApiEnv} />
        <AiConnectionProbeControls
            handleTestConnection={handleTestConnection}
            testStatus={testStatus}
        />
    </>
);

/**
 * Hook managing save and clear actions for Google AI Studio API key and environment configuration.
 *
 * @param {object} params
 * @param {string} params.keyInput - Current input key value
 * @param {Function} params.setApiKey - State setter for persistent API key
 * @param {string} params.aiEngine - Active AI engine ('gemini' | 'internal')
 * @param {Function} params.handleSelectEngine - Engine mode selection callback
 * @param {string} params.apiEnv - Target API environment ('auto' | 'preprod' | 'prod')
 * @param {Function} params.setShowSettings - State setter for drawer visibility
 * @param {Function} params.setKeyInput - State setter for key input field
 * @returns {{
 *   handleSave: () => void,
 *   handleClear: () => void
 * }}
 *
 * @example
 * const { handleSave, handleClear } = useAiStudioSettingsHandlers({
 *   keyInput: 'AIzaSy...',
 *   setApiKey: () => {},
 *   aiEngine: 'gemini',
 *   handleSelectEngine: () => {},
 *   apiEnv: 'prod',
 *   setShowSettings: () => {},
 *   setKeyInput: () => {}
 * });
 * handleSave();
 *
 * @example
 * const { handleClear } = useAiStudioSettingsHandlers({
 *   keyInput: '',
 *   setApiKey: () => {},
 *   aiEngine: 'internal',
 *   handleSelectEngine: () => {},
 *   apiEnv: 'auto',
 *   setShowSettings: () => {},
 *   setKeyInput: () => {}
 * });
 * handleClear();
 */
function useAiStudioSettingsHandlers({
    keyInput, setApiKey, aiEngine, handleSelectEngine,
    apiEnv, setShowSettings, setKeyInput
}) {
    const handleSave = () => {
        const k = keyInput.trim();
        setApiKey(k);
        if (k) {
            localStorage.setItem('familyTree_geminiKey', k);
            if (aiEngine !== 'internal' && handleSelectEngine) handleSelectEngine('gemini');
        } else {
            localStorage.removeItem('familyTree_geminiKey');
        }
        localStorage.setItem('familyTree_geminiEnv', apiEnv);
        setShowSettings(false);
    };

    const handleClear = () => {
        setApiKey('');
        setKeyInput('');
        localStorage.removeItem('familyTree_geminiKey');
        if (handleSelectEngine) handleSelectEngine('internal');
        setShowSettings(false);
    };

    return { handleSave, handleClear };
}

/**
 * Settings drawer component for configuring Gemini AI Studio API key, engine override, and endpoint environment.
 *
 * @param {object} props
 * @param {boolean} props.showSettings - Whether the settings drawer is visible
 * @param {Function} props.setShowSettings - State setter to show/hide the drawer
 * @param {string} props.keyInput - Current value of the API key input field
 * @param {Function} props.setKeyInput - State setter for keyInput
 * @param {string} props.apiKey - Persisted API key
 * @param {Function} props.setApiKey - State setter for apiKey
 * @param {string} props.apiEnv - Selected environment ('auto', 'preprod', 'prod')
 * @param {Function} props.setApiEnv - State setter for apiEnv
 * @param {string} props.aiEngine - Currently selected AI engine
 * @param {Function} props.handleSelectEngine - Callback to change the AI engine
 * @param {Function} props.handleTestConnection - Callback to test API connection
 * @param {object|null} props.testStatus - Current connectivity test status object
 * @returns {React.ReactNode|null} Rendered drawer element or null if closed
 *
 * @example
 *   <AiStudioSettingsDrawer
 *     showSettings={true}
 *     setShowSettings={() => {}}
 *     keyInput=""
 *     setKeyInput={() => {}}
 *     apiKey=""
 *     setApiKey={() => {}}
 *     apiEnv="auto"
 *     setApiEnv={() => {}}
 *     aiEngine="gemini"
 *     handleSelectEngine={() => {}}
 *     handleTestConnection={() => {}}
 *     testStatus={null}
 *   />
 *
 * @example
 *   <AiStudioSettingsDrawer
 *     showSettings={false}
 *     setShowSettings={fn}
 *     keyInput="AIza..."
 *     setKeyInput={fn}
 *     apiKey="AIza..."
 *     setApiKey={fn}
 *     apiEnv="prod"
 *     setApiEnv={fn}
 *     aiEngine="internal"
 *     handleSelectEngine={fn}
 *     handleTestConnection={fn}
 *     testStatus={{ ok: true, msg: 'Connected' }}
 *   />
 */
/**
 * Renders the header banner for the AI Studio settings drawer, including title and close trigger.
 *
 * @param {object} props
 * @param {() => void} props.onClose - Callback triggered when dismiss button is pressed
 * @returns {React.ReactNode} Rendered settings header
 *
 * @example
 * <AiStudioSettingsHeader onClose={() => setShowSettings(false)} />
 *
 * @example
 * <AiStudioSettingsHeader onClose={handleDismiss} />
 */
const AiStudioSettingsHeader = ({ onClose }) => (
    <>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[12px]">
                <span>✨</span>
                <span>Gemini AI Studio Settings</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer">✕</button>
        </div>
        <p className="text-[11px] text-slate-600 leading-snug">
            Connect your Google AI Studio API key (from <b>aistudio.google.com</b>).
        </p>
    </>
);

/**
 * Renders the footer note and external link for obtaining AI Studio API keys.
 *
 * @returns {React.ReactNode} Rendered settings footer
 *
 * @example
 * <AiStudioSettingsFooter />
 *
 * @example
 * const footer = <AiStudioSettingsFooter />;
 */
const AiStudioSettingsFooter = () => (
    <div className="flex items-center justify-between pt-0.5">
        <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[10.5px] text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
        >
            <span>Get API Key (Google AI Studio)</span>
            <span>↗</span>
        </a>
        <span className="text-[10px] text-slate-400">Stored safely in browser</span>
    </div>
);

/**
 * Renders the API key input row and provider environment configuration section inside the AI settings drawer.
 *
 * @param {Object} props - Component properties
 * @returns {React.ReactNode} Configuration controls section
 *
 * @example
 * <AiStudioSettingsContent keyInput="" setKeyInput={() => {}} apiKey="" onSave={() => {}} onClear={() => {}} aiEngine="gemini" handleSelectEngine={() => {}} apiEnv="prod" setApiEnv={() => {}} handleTestConnection={() => {}} testStatus="idle" />
 *
 * @example
 * <AiStudioSettingsContent keyInput="key" setKeyInput={() => {}} apiKey="key" onSave={() => {}} onClear={() => {}} aiEngine="gemini" handleSelectEngine={() => {}} apiEnv="prod" setApiEnv={() => {}} handleTestConnection={() => {}} testStatus="success" />
 */
const AiStudioSettingsContent = ({
    keyInput, setKeyInput, apiKey, onSave, onClear,
    aiEngine, handleSelectEngine, apiEnv, setApiEnv,
    handleTestConnection, testStatus
}) => (
    <div className="flex flex-col gap-1.5">
        <AiStudioKeyInputRow
            keyInput={keyInput} setKeyInput={setKeyInput} apiKey={apiKey}
            onSave={onSave} onClear={onClear}
        />
        <AiStudioEnvironmentConfig
            aiEngine={aiEngine} handleSelectEngine={handleSelectEngine}
            apiEnv={apiEnv} setApiEnv={setApiEnv}
            handleTestConnection={handleTestConnection} testStatus={testStatus}
        />
    </div>
);

/**
 * Settings configuration drawer for Google AI Studio and Anthropic Gemini/Claude credentials and environments.
 *
 * @param {Object} props - Component properties
 * @returns {React.ReactNode|null} Rendered drawer element or null if hidden
 *
 * @example
 * <AiStudioSettingsDrawer showSettings={true} setShowSettings={setShowSettings} {...settingsProps} />
 *
 * @example
 * <AiStudioSettingsDrawer showSettings={false} setShowSettings={setShowSettings} {...settingsProps} />
 */
const AiStudioSettingsDrawer = ({
    showSettings, setShowSettings, keyInput, setKeyInput,
    apiKey, setApiKey, apiEnv, setApiEnv, aiEngine, handleSelectEngine, handleTestConnection, testStatus
}) => {
    if (!showSettings) return null;

    const { handleSave, handleClear } = useAiStudioSettingsHandlers({
        keyInput, setApiKey, aiEngine, handleSelectEngine, apiEnv, setShowSettings, setKeyInput
    });

    return (
        <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-blue-200 text-xs flex flex-col gap-2 shrink-0 animate-fade-in">
            <AiStudioSettingsHeader onClose={() => setShowSettings(false)} />
            <AiStudioSettingsContent
                keyInput={keyInput} setKeyInput={setKeyInput} apiKey={apiKey}
                onSave={handleSave} onClear={handleClear} aiEngine={aiEngine}
                handleSelectEngine={handleSelectEngine} apiEnv={apiEnv} setApiEnv={setApiEnv}
                handleTestConnection={handleTestConnection} testStatus={testStatus}
            />
            <AiStudioSettingsFooter />
        </div>
    );
};

/**
 * Renders an engine attribution badge at the top of an AI assistant message bubble.
 *
 * @param {object} props
 * @param {boolean} [props.isGemini] - Whether the message was generated by Gemini
 * @returns {React.ReactNode} Engine attribution badge element
 *
 * @example
 * <AiEngineHeaderBadge isGemini={true} />
 *
 * @example
 * <AiEngineHeaderBadge isGemini={false} />
 */
const AiEngineHeaderBadge = ({ isGemini }) => (
    <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1.5 pb-1 border-b border-slate-100 ${isGemini ? 'text-indigo-600' : 'text-blue-600'}`}>
        <span>{isGemini ? '✨' : '⚙️'}</span>
        <span>{isGemini ? 'Gemini 2.5 Flash' : 'Internal Genealogy Engine'}</span>
    </div>
);

/**
 * Renders a clickable sample query item button in the AI assistant welcome message.
 *
 * @param {object} props
 * @param {string} props.sample - Sample query text
 * @param {Function} [props.onClick] - Callback when sample query is clicked
 * @returns {React.ReactNode} Formatted query button element
 *
 * @example
 * <AiSampleQueryButton sample="Who is the oldest person?" onClick={fn} />
 *
 * @example
 * <AiSampleQueryButton sample="Who all are in Kerala?" onClick={handleAsk} />
 */
const AiSampleQueryButton = ({ sample, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="text-left text-[12px] bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-medium px-3 py-2 rounded-xl border border-slate-200/80 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
    >
        <span>💬 {sample}</span>
        <span className="text-slate-400 group-hover:text-blue-600 text-[10px] transition-colors">Ask →</span>
    </button>
);

/**
 * Renders the list of suggested sample queries inside the welcome message bubble.
 *
 * @param {object} props
 * @param {string[]} props.sampleQueries - Suggested starter queries
 * @param {Function} [props.onSubmitQuery] - Callback when an example query is clicked
 * @returns {React.ReactNode} Formatted sample queries container element
 *
 * @example
 * <AiWelcomeQueriesSection sampleQueries={['Who are the children of John?']} onSubmitQuery={fn} />
 *
 * @example
 * <AiWelcomeQueriesSection sampleQueries={['Query 1', 'Query 2']} onSubmitQuery={handleAsk} />
 */
const AiWelcomeQueriesSection = ({ sampleQueries, onSubmitQuery }) => {
    if (!sampleQueries || sampleQueries.length === 0) return null;
    return (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Example queries:</div>
            <div className="flex flex-col gap-1.5">
                {sampleQueries.map((sample, sIdx) => (
                    <AiSampleQueryButton
                        key={sIdx}
                        sample={sample}
                        onClick={() => onSubmitQuery && onSubmitQuery(sample)}
                    />
                ))}
            </div>
        </div>
    );
};

/**
 * Renders an individual chat message bubble in the AI assistant conversation.
 *
 * @param {object} props
 * @param {object} props.message - Message data object with role, text, and flags
 * @param {Function} props.renderMessage - Markdown renderer function
 * @param {string[]} [props.sampleQueries] - Suggested starter queries if welcome bubble
 * @param {Function} [props.onSubmitQuery] - Callback when an example query is clicked
 * @returns {React.ReactNode} Formatted chat bubble element
 *
 * @example
 * <AiMessageBubble message={{ role: 'ai', text: 'Hello' }} renderMessage={fn} />
 *
 * @example
 * <AiMessageBubble message={{ role: 'user', text: 'Who is Alice?' }} renderMessage={fn} />
 */
const AiMessageBubble = ({ message, renderMessage, sampleQueries = [], onSubmitQuery = null }) => {
    const isAi = message.role === 'ai';
    return (
        <div className={`p-3.5 rounded-2xl max-w-[92%] shadow-sm ${isAi ? 'bg-white text-slate-700 self-start rounded-tl-sm border border-slate-200' : 'bg-blue-600 text-white self-end rounded-tr-sm'}`}>
            {isAi && !message.isWelcome && (
                <AiEngineHeaderBadge isGemini={message.isGemini} />
            )}
            {isAi ? renderMessage(message.text) : message.text}
            {message.isWelcome && (
                <AiWelcomeQueriesSection sampleQueries={sampleQueries} onSubmitQuery={onSubmitQuery} />
            )}
        </div>
    );
};

/**
 * Probes available Gemini models on a given base URL.
 *
 * @param {string} baseUrl - Base URL for the Gemini API
 * @param {string} activeKey - API key
 * @param {string[]} runLogs - Diagnostic logs array
 * @returns {Promise<{ models: string[], error: string|null }>} List of model identifiers
 *
 * @example
 * await _probeAvailableModels('https://generativelanguage.googleapis.com/v1beta', 'key123', logs);
 * // => { models: ['gemini-2.0-flash', 'gemini-1.5-pro'], error: null }
 *
 * @example
 * // Error response when key is invalid
 * await _probeAvailableModels('https://generativelanguage.googleapis.com/v1beta', 'bad-key', logs);
 * // => { models: [], error: 'HTTP 400 (INVALID_ARGUMENT): API key not valid' }
 */
async function _probeAvailableModels(baseUrl, activeKey, runLogs) {
    runLogs.push(`🌐 Probing endpoint: ${baseUrl}`);
    try {
        const listRes = await fetch(`${baseUrl}/models?key=${activeKey}`);
        const listData = await listRes.json();
        if (listData.models && Array.isArray(listData.models)) {
            const available = listData.models
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace(/^models\//, ''));
            runLogs.push(`📋 Available models on ${baseUrl}: ${available.join(', ')}`);
            const flash25Models = available.filter(m => m.includes('2.5-flash') || (m.includes('2.5') && m.includes('flash')));
            const otherFlashModels = available.filter(m => m.includes('flash') && !m.includes('2.5-flash') && !(m.includes('2.5') && m.includes('flash')));
            const proModels = available.filter(m => m.includes('pro') && !m.includes('flash'));
            const otherModels = available.filter(m => !m.includes('flash') && !m.includes('pro'));
            return { models: [...flash25Models, ...otherFlashModels, ...proModels, ...otherModels], error: null };
        } else if (listData.error) {
            const errStr = `HTTP ${listRes.status} (${listData.error.status}): ${listData.error.message}`;
            runLogs.push(`❌ ListModels failed on ${baseUrl}: ${errStr}`);
            return { models: [], error: errStr };
        }
    } catch (listErr) {
        const errStr = `❌ ListModels network error on ${baseUrl}: ${listErr.message || listErr}`;
        runLogs.push(errStr);
        return { models: [], error: errStr };
    }
    return { models: [], error: null };
}

/**
 * Builds the JSON request payload for Gemini generateContent endpoint.
 *
 * @param {string} promptText - Prompt text
 * @returns {Object} JSON payload with contents and generation config
 *
 * @example
 * _buildGenerateContentPayload('Hello');
 * // => { contents: [{ parts: [{ text: 'Hello' }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1000 } }
 *
 * @example
 * _buildGenerateContentPayload('Who is the oldest ancestor?');
 * // => { contents: [{ parts: [{ text: 'Who is the oldest ancestor?' }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1000 } }
 */
function _buildGenerateContentPayload(promptText) {
    return {
        contents: [{
            parts: [{ text: promptText }]
        }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000
        }
    };
}

/**
 * Parses the response from the Gemini generateContent API, updating logs and returning outcome.
 *
 * @param {Object} result - JSON response from API
 * @param {Response} response - Fetch response object
 * @param {string} cleanModelName - Model identifier without prefix
 * @param {string[]} runLogs - Diagnostic logs collector
 * @returns {{ text: string|null, error: string|null, shouldStop: boolean }} Outcome
 *
 * @example
 * _parseGenerateContentResult(result, response, 'gemini-1.5-flash', logs);
 * // => { text: 'Hello', error: null, shouldStop: true }
 *
 * @example
 * _parseGenerateContentResult({ error: { code: 404, message: 'Not found', status: 'NOT_FOUND' } }, { status: 404 }, 'gemini-1.5-pro', logs);
 * // => { text: null, error: 'HTTP 404 (NOT_FOUND): Not found', shouldStop: false }
 */
function _parseGenerateContentResult(result, response, cleanModelName, runLogs) {
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        runLogs.push(`✅ Successfully received response from ${cleanModelName}`);
        return { text: result.candidates[0].content.parts[0].text, error: null, shouldStop: true };
    }
    if (result.error) {
        const errStr = `HTTP ${response.status} (${result.error.status}): ${result.error.message}`;
        runLogs.push(`⚠️ ${cleanModelName} returned error: ${errStr}`);
        const isNotFound = result.error.code === 404 || errStr.toLowerCase().includes('not found');
        return { text: null, error: errStr, shouldStop: !isNotFound };
    }
    return { text: null, error: null, shouldStop: false };
}

/**
 * Sends a content generation request to a specific Gemini model.
 *
 * @param {string} baseUrl - Base URL for the Gemini API
 * @param {string} modelName - Target model name (e.g., 'gemini-2.5-flash')
 * @param {string} activeKey - API key
 * @param {string} promptText - Combined prompt string
 * @param {string[]} runLogs - Diagnostic logs array
 * @returns {Promise<{ text: string|null, error: string|null, shouldStop: boolean }>} Generation result
 *
 * @example
 * await _executeModelGenerateContent('https://generativelanguage.googleapis.com/v1beta', 'gemini-2.5-flash', 'key', 'Hello', logs);
 * // => { text: 'Hello! How can I help?', error: null, shouldStop: true }
 *
 * @example
 * // Network failure handling
 * await _executeModelGenerateContent('https://generativelanguage.googleapis.com/v1beta', 'gemini-1.5-pro', 'key', 'Explain tree', logs);
 * // => { text: null, error: 'Failed to fetch', shouldStop: false }
 */
async function _executeModelGenerateContent(baseUrl, modelName, activeKey, promptText, runLogs) {
    const cleanModelName = modelName.replace(/^models\//, '');
    const apiUrl = `${baseUrl}/models/${cleanModelName}:generateContent?key=${activeKey}`;
    runLogs.push(`🚀 Sending prompt to: ${cleanModelName} (${baseUrl})`);

    try {
        const requestBody = _buildGenerateContentPayload(promptText);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        return _parseGenerateContentResult(result, response, cleanModelName, runLogs);
    } catch (fetchErr) {
        const errStr = fetchErr.message || String(fetchErr);
        runLogs.push(`⚠️ Fetch error on ${modelName}: ${errStr}`);
        return { text: null, error: errStr, shouldStop: false };
    }
}

/**
 * Iterates through candidate models on a base URL until a successful generation response is obtained.
 *
 * @private
 * @param {Object} options
 * @param {string} options.baseUrl - Base API endpoint URL
 * @param {string} options.activeKey - Gemini API key
 * @param {string} options.promptText - Full synthesized prompt text
 * @param {Array<string>} options.runLogs - Execution log sink
 * @param {Array<string>} options.defaultFallbackModels - Fallback models list
 * @returns {Promise<{ text: string|null, answered: boolean, lastError: string|null }>} Generation result
 *
 * @example
 * const res = await _queryEndpointModels({ baseUrl: 'https://api.example.com', activeKey: 'k', promptText: 'Hi', runLogs: [], defaultFallbackModels: ['gemini-2.5-flash'] });
 * // => { text: 'Hello', answered: true, lastError: null }
 *
 * @example
 * const res = await _queryEndpointModels({ baseUrl: 'https://bad.example.com', activeKey: 'bad', promptText: 'Hi', runLogs: [], defaultFallbackModels: [] });
 * // => { text: null, answered: false, lastError: 'NetworkError' }
 */
async function _queryEndpointModels({ baseUrl, activeKey, promptText, runLogs, defaultFallbackModels }) {
    const { models, error } = await _probeAvailableModels(baseUrl, activeKey, runLogs);
    let lastError = error || null;
    const modelsToTry = models.length > 0 ? models : defaultFallbackModels;

    for (const modelName of modelsToTry) {
        const res = await _executeModelGenerateContent(baseUrl, modelName, activeKey, promptText, runLogs);
        if (res.text) return { text: res.text, answered: true, lastError: null };
        if (res.error) lastError = res.error;
        if (res.shouldStop) break;
    }
    return { text: null, answered: false, lastError };
}

/**
 * Probes available Gemini API endpoints and model candidates, submitting the prompt
 * and returning the generated response text or reporting failure diagnostics.
 * 
 * @param {string} userMsg - User query string
 * @param {string} activeKey - Valid Gemini API key
 * @param {string[]} endpoints - Base URLs for Gemini API
 * @param {string} systemPrompt - Structured system prompt with tree context
 * @param {string[]} runLogs - Array collecting operational diagnostics
 * @returns {Promise<{ text: string|null, answeredByGemini: boolean, lastApiError: string|null }>} Generation outcome
 *
 * @example
 * const result = await _queryGeminiEndpoints('Who is the oldest ancestor?', 'key123', ['https://generativelanguage.googleapis.com/v1beta'], 'Tree context...', logs);
 * console.log(result.answeredByGemini); // true
 *
 * @example
 * // Fallback when endpoints fail
 * const result = await _queryGeminiEndpoints('Test query', 'invalid-key', ['https://bad-endpoint'], 'System prompt', logs);
 * console.log(result.answeredByGemini); // false
 */
async function _queryGeminiEndpoints(userMsg, activeKey, endpoints, systemPrompt, runLogs) {
    let lastApiError = null;
    const defaultFallbackModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-pro'];
    const promptText = `${systemPrompt}\n\nQuestion: ${userMsg}`;

    for (const baseUrl of endpoints) {
        const res = await _queryEndpointModels({ baseUrl, activeKey, promptText, runLogs, defaultFallbackModels });
        if (res.answered) {
            return { text: res.text, answeredByGemini: true, lastApiError: null };
        }
        if (res.lastError) lastApiError = res.lastError;
    }

    return { text: null, answeredByGemini: false, lastApiError };
}

/**
 * Executes a query against Gemini endpoints with automatic fallback to the local genealogy engine.
 *
 * @param {string} userMsg - The user's natural language question.
 * @param {string} activeKey - Gemini API key.
 * @param {object} tree - Family tree domain model.
 * @param {string} apiEnv - API environment mode ('direct' or 'proxy').
 * @param {GenealogyEngine} engine - Local genealogy deduction engine.
 * @param {Array<string>} runLogs - Diagnostics log collector.
 * @returns {Promise<{ text: string, answeredByGemini: boolean }>} Query outcome.
 *
 * @example
 * await _executeGeminiQueryWithFallback('Who is Paul?', apiKey, tree, 'direct', engine, logs);
 * // => { text: 'Paul is the son of...', answeredByGemini: true }
 *
 * @example
 * // Fallback to local engine when API fails
 * await _executeGeminiQueryWithFallback('How many generations?', '', tree, 'direct', engine, logs);
 * // => { text: 'There are 5 generations...', answeredByGemini: false }
 */
async function _executeGeminiQueryWithFallback(userMsg, activeKey, tree, apiEnv, engine, runLogs) {
    try {
        const treeContext = buildTreeAIContext(tree);
        const systemPrompt = buildGenealogySystemPrompt(treeContext);
        const endpoints = getGeminiEndpoints(apiEnv);

        const outcome = await _queryGeminiEndpoints(userMsg, activeKey, endpoints, systemPrompt, runLogs);
        let text = outcome.text;
        let answeredByGemini = outcome.answeredByGemini;

        if (!text || !answeredByGemini) {
            runLogs.push(`ℹ️ External AI unavailable (${outcome.lastApiError || 'No response'}). Serving best local genealogy answer.`);
            text = engine.fallbackAnswer(userMsg);
            answeredByGemini = false;
        }
        return { text, answeredByGemini };
    } catch (apiErr) {
        runLogs.push(`⚠️ Network/API Exception: ${apiErr.message || apiErr}`);
        return { text: engine.fallbackAnswer(userMsg), answeredByGemini: false };
    }
}

/**
 * Probes a single Gemini API test endpoint and appends diagnostics to the test logs.
 *
 * @param {{ name: string, url: string }} ep - Endpoint descriptor
 * @param {string} key - API key
 * @param {Array<string>} testLogs - Mutable log array collecting probe status
 * @returns {Promise<boolean>} True if endpoint successfully returned generation models
 *
 * @example
 * await _probeGeminiTestEndpoint(ep, 'AIzaSy...', logs); // => true / false
 *
 * @example
 * await _probeGeminiTestEndpoint({ name: 'Public Prod', url: 'https://generativelanguage.googleapis.com' }, 'badkey', logs);
 * // => false
 */
async function _probeGeminiTestEndpoint(ep, key, testLogs) {
    try {
        testLogs.push(`Testing ${ep.name} (${ep.url})...`);
        const res = await fetch(`${ep.url}/models?key=${key}`);
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
            const genModels = data.models
                .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                .map(m => m.name.replace(/^models\//, ''));
            testLogs.push(`✅ ${ep.name}: Connected! Found ${genModels.length} models (${genModels.slice(0, 5).join(', ')}...)`);
            return true;
        }
        if (data.error) {
            testLogs.push(`❌ ${ep.name}: HTTP ${res.status} (${data.error.status}): ${data.error.message}`);
        }
    } catch (err) {
        testLogs.push(`❌ ${ep.name}: Network Error: ${err.message || err}`);
    }
    return false;
}

/**
 * Tests connectivity to Google AI Studio endpoints using the provided API key.
 *
 * @param {string} apiKey - API key to validate
 * @returns {Promise<{ ok: boolean, msg: string, logs: string[] }>} Connection test result
 *
 * @example
 * const result = await testGeminiApiConnection('AIzaSy...');
 * // => { ok: true, msg: 'Connection Successful!', logs: [...] }
 *
 * @example
 * const result = await testGeminiApiConnection('');
 * // => { ok: false, msg: 'Please enter an API key first.', logs: [] }
 */
async function testGeminiApiConnection(apiKey) {
    const key = (apiKey || '').trim();
    if (!key) {
        return { ok: false, msg: "Please enter an API key first.", logs: [] };
    }

    const testLogs = [];
    const testEndpoints = [
        { name: 'Google AI Studio', url: 'https://generativelanguage.googleapis.com/v1beta' }
    ];

    let anySuccess = false;
    for (const ep of testEndpoints) {
        const success = await _probeGeminiTestEndpoint(ep, key, testLogs);
        if (success) anySuccess = true;
    }

    return {
        ok: anySuccess,
        msg: anySuccess ? "Connection Successful!" : "Connection Failed. See Diagnostics below.",
        logs: testLogs
    };
}

/**
 * Generates dynamic sample query suggestions tailored to persons and places present in the loaded tree.
 *
 * @param {FamilyTree} tree - Populated family tree instance
 * @returns {string[]} List of 3-4 natural language sample query prompts
 *
 * @example
 * buildSampleAiQueries(tree)
 * // => ["Who is John's husband / wife?", "Who are the children of Mary?", "Who is the oldest person in Kerala?", "Who is the earliest ancestor?"]
 *
 * @example
 * buildSampleAiQueries(null)
 * // => ["Who is the earliest ancestor?"]
 */
function buildSampleAiQueries(tree) {
    if (!tree) return ["Who is the earliest ancestor?"];
    const samples = [];
    const knownPeople = tree.all.filter(p => !p.isGhost && !p._isUnknown);
    const withSpouse = knownPeople.find(p => p.partners.length > 0);
    if (withSpouse) samples.push(`Who is ${withSpouse.name}'s husband / wife?`);
    else samples.push("Who is Ammini's husband?");
    
    const withChildren = knownPeople.find(p => p.children.length > 1);
    if (withChildren) samples.push(`Who are the children of ${withChildren.name}?`);
    else samples.push("Who are the children of Brijitha?");

    const withPlace = knownPeople.find(p => p.place && p.place.trim().length > 2);
    if (withPlace) samples.push(`Who is the oldest person in ${withPlace.place.trim()}?`);
    else samples.push("Who is the oldest person in California?");

    samples.push("Who is the earliest ancestor?");
    return samples;
}

/**
 * Extracts referenced person profile IDs from an AI markdown response, either via markdown links or entity recognition.
 *
 * @param {string} responseStr - Markdown text returned by the model or engine
 * @param {FamilyTree} tree - Active family tree model
 * @returns {string[]} Array of unique person IDs mentioned in the response
 *
 * @example
 * extractMentionedProfileIds('See [John Doe](p1)', tree)
 * // => ['p1']
 *
 * @example
 * extractMentionedProfileIds('No links here, just plain text', tree)
 * // => []
 */
function extractMentionedProfileIds(responseStr, tree) {
    if (!responseStr || typeof responseStr !== 'string' || !tree) return [];
    const ids = new Set();
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(responseStr)) !== null) {
        const id = match[2];
        if (tree.get(id)) ids.add(id);
    }
    if (ids.size === 0) {
        const engine = new GenealogyEngine(tree);
        const candidates = engine.extractPeopleFromQuery(responseStr);
        candidates.forEach(p => ids.add(p.id));
    }
    return Array.from(ids);
}

/**
 * Dispatches an AI or local engine response into the message feed, attaching diagnostic logs
 * and notifying external listeners about any mentioned person profile IDs.
 *
 * @param {object} params
 * @param {string} params.responseText - Markdown response content
 * @param {boolean} params.isGemini - True if answered by external Gemini model
 * @param {string[]} params.runLogs - Diagnostics trace logs collected during execution
 * @param {FamilyTree} params.tree - Active family tree model
 * @param {Function} [params.onAiProfilesResponded] - Callback invoked with detected profile IDs
 * @param {Function} params.setMessages - React message state setter
 *
 * @example
 * dispatchAiResponse({
 *   responseText: 'Found [John](p1).',
 *   isGemini: true,
 *   runLogs: ['Engine: Gemini'],
 *   tree,
 *   onAiProfilesResponded: ids => console.log(ids),
 *   setMessages
 * });
 *
 * @example
 * dispatchAiResponse({
 *   responseText: 'Direct answer without profiles',
 *   isGemini: false,
 *   runLogs: [],
 *   tree,
 *   setMessages
 * });
 */
function dispatchAiResponse({ responseText, isGemini, runLogs, tree, onAiProfilesResponded, setMessages }) {
    setMessages(prev => [...prev, { role: 'ai', text: responseText, isGemini, diagnostics: runLogs }]);
    const mentioned = extractMentionedProfileIds(responseText, tree);
    if (mentioned.length > 0 && typeof onAiProfilesResponded === 'function') {
        onAiProfilesResponded(mentioned);
    }
}

/**
 * Executes a natural language query either using the internal local genealogy engine
 * or via external Gemini model, returning the markdown answer and provider metadata.
 *
 * @param {object} params
 * @param {string} params.userMsg - Clean user question string
 * @param {string} params.aiEngine - 'internal' or 'gemini'
 * @param {string} params.activeKey - Gemini API key
 * @param {FamilyTree} params.tree - Family tree instance
 * @param {string} params.apiEnv - API environment mode
 * @param {GenealogyEngine} params.engine - Local genealogy deduction engine
 * @param {string[]} params.runLogs - Execution diagnostic log collector
 * @returns {Promise<{ text: string, isGemini: boolean, requiresKeyConfig?: boolean }>} Query result
 *
 * @example
 * const result = await executeAiAssistantQuery({
 *   userMsg: 'Who is John?',
 *   aiEngine: 'internal',
 *   activeKey: '',
 *   tree,
 *   apiEnv: 'auto',
 *   engine,
 *   runLogs: []
 * });
 * // => { text: 'John is the son of...', isGemini: false }
 *
 * @example
 * const result = await executeAiAssistantQuery({
 *   userMsg: 'Find descendants of Mary',
 *   aiEngine: 'gemini',
 *   activeKey: 'AIzaSy...',
 *   tree,
 *   apiEnv: 'auto',
 *   engine,
 *   runLogs: []
 * });
 * // => { text: 'Mary has 3 children...', isGemini: true }
 */
async function executeAiAssistantQuery({ userMsg, aiEngine, activeKey, tree, apiEnv, engine, runLogs }) {
    if (aiEngine === 'internal') {
        runLogs.push('⚙️ Engine override: Internal Genealogy Engine selected.');
        const directLocalAnswer = engine.tryDirectAnswer(userMsg);
        const answer = directLocalAnswer || engine.fallbackAnswer(userMsg);
        return { text: answer, isGemini: false };
    }

    runLogs.push('✨ Engine override: External Gemini 2.5 Flash selected.');
    if (!activeKey) {
        const promptMsg = "⚠️ **Gemini 2.5 Flash** is selected, but no API key is configured. Please enter your Gemini API key in the settings above, or switch the toggle to **Internal Engine**.";
        return { text: promptMsg, isGemini: false, requiresKeyConfig: true };
    }

    try {
        const outcome = await _executeGeminiQueryWithFallback(userMsg, activeKey, tree, apiEnv, engine, runLogs);
        return { text: outcome.text, isGemini: outcome.answeredByGemini };
    } catch (err) {
        return { text: engine.fallbackAnswer(userMsg), isGemini: false };
    }
}

/**
 * Renders an individual selectable mode button for the AI engine selector.
 *
 * @param {object} props
 * @param {string} props.mode - Target engine mode ('gemini' or 'internal')
 * @param {boolean} props.isActive - Whether this engine mode is currently active
 * @param {string} props.activeColor - Tailwind color classes when active
 * @param {string} props.dotClass - Tailwind class for the indicator dot
 * @param {string} props.title - Tooltip description for the button
 * @param {string} props.label - Display text label
 * @param {Function} props.onSelect - Callback invoked when button is clicked
 * @returns {React.ReactNode}
 *
 * @example
 * <AiEngineOptionButton mode="gemini" isActive={true} activeColor="text-emerald-700" dotClass="bg-emerald-500 animate-pulse" title="Gemini" label="Gemini 2.5 Flash" onSelect={() => {}} />
 *
 * @example
 * <AiEngineOptionButton mode="internal" isActive={false} activeColor="text-blue-700" dotClass="bg-slate-400" title="Internal" label="Internal Engine" onSelect={() => {}} />
 */
const AiEngineOptionButton = ({ mode, isActive, activeColor, dotClass, title, label, onSelect }) => (
    <button
        type="button"
        onClick={() => onSelect(mode)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            isActive
                ? `bg-white ${activeColor} font-bold shadow-xs`
                : 'text-slate-600 hover:text-slate-900'
        }`}
        title={title}
    >
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
        <span>{label}</span>
    </button>
);

/**
 * Renders toggle buttons for switching between Gemini external API and internal genealogy engine.
 *
 * @param {object} props
 * @param {string} props.aiEngine - Active engine mode ('gemini' or 'internal')
 * @param {string} props.apiKey - Configured Gemini API key
 * @param {Function} props.handleSelectEngine - Engine mode selection callback
 * @returns {React.ReactNode}
 *
 * @example
 * <AiEngineModeSelector aiEngine="gemini" apiKey="AIza..." handleSelectEngine={() => {}} />
 *
 * @example
 * <AiEngineModeSelector aiEngine="internal" apiKey="" handleSelectEngine={() => {}} />
 */
const AiEngineModeSelector = ({ aiEngine, apiKey, handleSelectEngine }) => (
    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/60 text-[11px] font-medium shadow-2xs">
        <AiEngineOptionButton
            mode="gemini"
            isActive={aiEngine === 'gemini'}
            activeColor="text-emerald-700"
            dotClass={aiEngine === 'gemini' ? (apiKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400') : 'bg-slate-400'}
            title="Override: Send queries to external Gemini 2.5 Flash"
            label="Gemini 2.5 Flash"
            onSelect={handleSelectEngine}
        />
        <AiEngineOptionButton
            mode="internal"
            isActive={aiEngine === 'internal'}
            activeColor="text-blue-700"
            dotClass={aiEngine === 'internal' ? 'bg-blue-600' : 'bg-slate-400'}
            title="Override: Send queries to internal genealogy engine"
            label="Internal Engine"
            onSelect={handleSelectEngine}
        />
    </div>
);

/**
 * Renders toolbar action buttons for toggling AI diagnostics logs and opening settings drawer.
 *
 * @param {object} props
 * @param {boolean} props.hasDiagnostics - Whether diagnostic logs are available
 * @param {boolean} props.showDiag - Whether diagnostics panel is open
 * @param {Function} props.setShowDiag - Diagnostics panel visibility setter
 * @param {boolean} props.showSettings - Whether settings drawer is open
 * @param {Function} props.setShowSettings - Settings drawer visibility setter
 * @param {string} props.apiKey - Configured Gemini API key
 * @param {Function} props.setKeyInput - Key input field setter
 * @returns {React.ReactNode}
 *
 * @example
 * <AiEngineToolbarActions hasDiagnostics={true} showDiag={false} setShowDiag={() => {}} showSettings={false} setShowSettings={() => {}} apiKey="key" setKeyInput={() => {}} />
 *
 * @example
 * <AiEngineToolbarActions hasDiagnostics={false} showDiag={false} setShowDiag={() => {}} showSettings={true} setShowSettings={() => {}} apiKey="" setKeyInput={() => {}} />
 */
const AiEngineToolbarActions = ({
    hasDiagnostics, showDiag, setShowDiag,
    showSettings, setShowSettings, apiKey, setKeyInput
}) => (
    <div className="flex items-center gap-1 shrink-0">
        {hasDiagnostics && (
            <button
                type="button"
                onClick={() => setShowDiag(!showDiag)}
                className={`p-1 px-2 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${showDiag ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/70'}`}
                title="View AI Diagnostics & Logs"
            >
                <span>🐞</span>
                <span>Logs</span>
            </button>
        )}
        <button
            type="button"
            onClick={() => { setShowSettings(!showSettings); setKeyInput(apiKey); }}
            className={`p-1 px-2 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${showSettings ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-200/70'}`}
            title="Configure Gemini API Key"
        >
            <span>⚙️</span>
            <span>{apiKey ? 'Settings' : 'Connect Key'}</span>
        </button>
    </div>
);

/**
 * Header toggle bar allowing users to switch between external Gemini API and internal rule engine,
 * and access engine settings or diagnostic logs.
 *
 * @param {object} props
 * @param {string} props.aiEngine - Active engine mode ('gemini' or 'internal')
 * @param {string} props.apiKey - Configured Gemini API key
 * @param {Function} props.handleSelectEngine - Engine mode selection callback
 * @param {boolean} props.hasDiagnostics - Whether diagnostic logs are available
 * @param {boolean} props.showDiag - Diagnostics drawer visibility state
 * @param {Function} props.setShowDiag - Diagnostics drawer toggle function
 * @param {boolean} props.showSettings - Settings drawer visibility state
 * @param {Function} props.setShowSettings - Settings drawer toggle function
 * @param {Function} props.setKeyInput - State setter to sync key input on opening settings
 * @returns {React.ReactNode}
 *
 * @example
 * <AiEngineToggle
 *   aiEngine="gemini"
 *   apiKey="AIzaSy..."
 *   handleSelectEngine={(mode) => {}}
 *   hasDiagnostics={true}
 *   showDiag={false}
 *   setShowDiag={setShowDiag}
 *   showSettings={false}
 *   setShowSettings={setShowSettings}
 *   setKeyInput={setKeyInput}
 * />
 *
 * @example
 * <AiEngineToggle
 *   aiEngine="internal"
 *   apiKey=""
 *   handleSelectEngine={() => {}}
 *   hasDiagnostics={false}
 *   showDiag={false}
 *   setShowDiag={() => {}}
 *   showSettings={false}
 *   setShowSettings={() => {}}
 *   setKeyInput={() => {}}
 * />
 */
const AiEngineToggle = ({
    aiEngine,
    apiKey,
    handleSelectEngine,
    hasDiagnostics,
    showDiag,
    setShowDiag,
    showSettings,
    setShowSettings,
    setKeyInput
}) => (
    <div className="px-3.5 py-2 bg-slate-100/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between text-xs shrink-0 select-none">
        <AiEngineModeSelector
            aiEngine={aiEngine}
            apiKey={apiKey}
            handleSelectEngine={handleSelectEngine}
        />
        <AiEngineToolbarActions
            hasDiagnostics={hasDiagnostics}
            showDiag={showDiag}
            setShowDiag={setShowDiag}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            apiKey={apiKey}
            setKeyInput={setKeyInput}
        />
    </div>
);

/**
 * Form input bar at the bottom of the AI assistant chat, styled with adaptive placeholder
 * and submit action button reflecting the active AI engine.
 *
 * @param {object} props
 * @param {string} props.input - Current input query string
 * @param {Function} props.setInput - State setter for input
 * @param {Function} props.onSubmit - Submit event handler
 * @param {boolean} props.isLoading - Whether AI is processing a query
 * @param {string} props.aiEngine - Active AI engine ('gemini' or 'internal')
 * @returns {React.ReactNode}
 *
 * @example
 * <AiAssistantInputForm
 *   input="Who is Paul?"
 *   setInput={setInput}
 *   onSubmit={handleAsk}
 *   isLoading={false}
 *   aiEngine="gemini"
 * />
 *
 * @example
 * <AiAssistantInputForm
 *   input=""
 *   setInput={setInput}
 *   onSubmit={handleAsk}
 *   isLoading={true}
 *   aiEngine="internal"
 * />
 */
const AiAssistantInputForm = ({ input, setInput, onSubmit, isLoading, aiEngine }) => {
    return (
        <form onSubmit={onSubmit} className="p-4 border-t border-slate-100 flex gap-2 bg-slate-50 pb-6 shrink-0">
            <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={aiEngine === 'gemini' ? "Ask Gemini 2.5 Flash with full tree context..." : "Ask Internal Genealogy Engine (instant local lookup)..."}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-[13px] outline-none focus:ring-2 ring-blue-500 transition-all shadow-inner"
            />
            <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={`text-white p-2 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center min-w-[40px] shadow-sm cursor-pointer ${aiEngine === 'gemini' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                title={aiEngine === 'gemini' ? "Send query to Gemini 2.5 Flash" : "Send query to Internal Genealogy Engine"}
            >
                <Icons.Sparkles />
            </button>
        </form>
    );
};

/**
 * Reads a persisted UI setting, tolerating environments that have no `window`.
 *
 * The standalone HTML export and any non-browser evaluation lack `window`, so
 * every read has to be guarded. Centralizing the guard also forces each call
 * site to state its own fallback instead of trailing a bare `|| ''`.
 *
 * @param {string} key - localStorage key (e.g. 'familyTree_geminiKey')
 * @param {string} [fallback=''] - Value returned when unset or unavailable
 * @returns {string} Stored value, or the fallback when missing
 *
 * @example
 * readStoredSetting('familyTree_geminiKey')
 * // => 'AIza...' (or '' when never configured)
 *
 * @example
 * readStoredSetting('familyTree_geminiEnv', 'auto')
 * // => 'auto' (key absent, or running outside a browser)
 */
function readStoredSetting(key, fallback = '') {
    return (typeof window !== 'undefined' && localStorage.getItem(key)) || fallback;
}

/**
 * Resolves the initial AI engine selection from localStorage or available API keys.
 *
 * @returns {string} Initial engine mode ('gemini' | 'internal')
 *
 * @example
 * const engine = getInitialAiEngine();
 *
 * @example
 * // Fallback when window is undefined or localStorage is empty
 * const defaultEngine = getInitialAiEngine();
 * console.log(defaultEngine); // 'internal'
 */
function getInitialAiEngine() {
    const saved = readStoredSetting('familyTree_aiEngine');
    if (saved === 'gemini' || saved === 'internal') return saved;
    return readStoredSetting('familyTree_geminiKey').trim() ? 'gemini' : 'internal';
}

/**
 * Tests connection to Google AI Studio using the provided key and updates status state.
 *
 * @param {object} params
 * @param {string} params.keyInput - Draft API key input
 * @param {string} params.apiKey - Currently saved API key
 * @param {Function} params.setTestStatus - State updater for connection test status
 * @param {Function} params.setAiDiagnostics - State updater for connection logs
 * @returns {Promise<void>}
 *
 * @example
 * await executeGeminiConnectionTest({
 *   keyInput: 'AIzaSy...',
 *   apiKey: '',
 *   setTestStatus: (s) => {},
 *   setAiDiagnostics: (l) => {}
 * });
 *
 * @example
 * // Handle empty key
 * await executeGeminiConnectionTest({
 *   keyInput: '',
 *   apiKey: '',
 *   setTestStatus: (s) => {},
 *   setAiDiagnostics: (l) => {}
 * });
 */
async function executeGeminiConnectionTest({ keyInput, apiKey, setTestStatus, setAiDiagnostics }) {
    const k = keyInput.trim() || apiKey.trim();
    if (!k) {
        setTestStatus({ ok: false, msg: "Please enter an API key first." });
        return;
    }
    setTestStatus({ loading: true, msg: "Testing connection to Google AI Studio..." });
    const result = await testGeminiApiConnection(k);
    setAiDiagnostics(result.logs);
    setTestStatus({
        ok: result.ok,
        loading: false,
        msg: result.msg,
        logs: result.logs
    });
}

/**
 * Hook to manage selected AI inference engine mode and automatic settings drawer reveal.
 *
 * @param {string} apiKey - Active Gemini API key.
 * @returns {{
 *   aiEngine: string,
 *   setAiEngine: Function,
 *   showSettings: boolean,
 *   setShowSettings: Function,
 *   handleSelectEngine: Function
 * }}
 *
 * @example
 * const { aiEngine, handleSelectEngine } = useAiEngineState('key123');
 * handleSelectEngine('gemini');
 *
 * @example
 * const { aiEngine, showSettings } = useAiEngineState('');
 */
function useAiEngineState(apiKey) {
    const [aiEngine, setAiEngine] = useState(getInitialAiEngine);
    const [showSettings, setShowSettings] = useState(false);

    const handleSelectEngine = useCallback((mode) => {
        setAiEngine(mode);
        if (typeof window !== 'undefined') {
            localStorage.setItem('familyTree_aiEngine', mode);
        }
        if (mode === 'gemini') {
            const currentKey = apiKey || readStoredSetting('familyTree_geminiKey');
            if (!currentKey.trim()) {
                setShowSettings(true);
            }
        }
    }, [apiKey]);

    return {
        aiEngine,
        setAiEngine,
        showSettings,
        setShowSettings,
        handleSelectEngine
    };
}

/**
 * Hook to manage AI connection diagnostics, custom key input, and test status state.
 *
 * @param {string} apiKey - Currently active API key.
 * @returns {Object} Key input state, diagnostics state, and test connection handler.
 *
 * @example
 * const diag = useAiDiagnosticsState('key123');
 *
 * @example
 * const { testStatus, handleTestConnection } = useAiDiagnosticsState('');
 */
function useAiDiagnosticsState(apiKey) {
    const [keyInput, setKeyInput] = useState(apiKey);
    const [aiDiagnostics, setAiDiagnostics] = useState([]);
    const [showDiag, setShowDiag] = useState(false);
    const [testStatus, setTestStatus] = useState(null);

    const handleTestConnection = useCallback(() => {
        return executeGeminiConnectionTest({ keyInput, apiKey, setTestStatus, setAiDiagnostics });
    }, [keyInput, apiKey]);

    return {
        keyInput,
        setKeyInput,
        aiDiagnostics,
        setAiDiagnostics,
        showDiag,
        setShowDiag,
        testStatus,
        setTestStatus,
        handleTestConnection
    };
}

/**
 * Hook managing AI Studio and Gemini API configuration state, including API key,
 * execution environment, active AI engine selection, and connection probe testing.
 *
 * @returns {{
 *   apiKey: string,
 *   setApiKey: React.Dispatch<React.SetStateAction<string>>,
 *   apiEnv: string,
 *   setApiEnv: React.Dispatch<React.SetStateAction<string>>,
 *   aiEngine: string,
 *   setAiEngine: React.Dispatch<React.SetStateAction<string>>,
 *   handleSelectEngine: (mode: string) => void,
 *   showSettings: boolean,
 *   setShowSettings: React.Dispatch<React.SetStateAction<boolean>>,
 *   keyInput: string,
 *   setKeyInput: React.Dispatch<React.SetStateAction<string>>,
 *   aiDiagnostics: Array<object>,
 *   setAiDiagnostics: React.Dispatch<React.SetStateAction<Array<object>>>,
 *   showDiag: boolean,
 *   setShowDiag: React.Dispatch<React.SetStateAction<boolean>>,
 *   testStatus: object|null,
 *   setTestStatus: React.Dispatch<React.SetStateAction<object|null>>,
 *   handleTestConnection: () => Promise<void>
 * }}
 *
 * @example
 * const { apiKey, aiEngine, handleSelectEngine } = useAiAssistantConfig();
 * handleSelectEngine('gemini');
 *
 * @example
 * const { testStatus, handleTestConnection } = useAiAssistantConfig();
 * await handleTestConnection();
 */
function useAiAssistantConfig() {
    const [apiKey, setApiKey] = useState(() => readStoredSetting('familyTree_geminiKey'));
    const [apiEnv, setApiEnv] = useState(() => readStoredSetting('familyTree_geminiEnv', 'auto'));
    const engineState = useAiEngineState(apiKey);
    const diagState = useAiDiagnosticsState(apiKey);

    return {
        apiKey,
        setApiKey,
        apiEnv,
        setApiEnv,
        ...engineState,
        ...diagState
    };
}

/**
 * Returns the default introductory welcome message object for the AI assistant chat history.
 *
 * @returns {{ role: string, text: string, isWelcome: boolean }}
 *
 * @example
 * const welcome = buildDefaultAiWelcomeMessage();
 * console.log(welcome.role); // 'ai'
 *
 * @example
 * const { text, isWelcome } = buildDefaultAiWelcomeMessage();
 * console.log(isWelcome); // true
 */
function buildDefaultAiWelcomeMessage() {
    return {
        role: 'ai',
        text: 'Hi! Ask me anything about the loaded family tree.\n\n• Use the toggle above to override between **Gemini 2.5 Flash** (external AI) and the **Internal Engine** (instant local lookups).\n• **Gemini 2.5 Flash**: performs advanced multi-hop reasoning with full tree context.\n• **Internal Engine**: fast, offline local genealogical deductions for spouses, parents, children, and locations.',
        isWelcome: true
    };
}

/**
 * Hook to automatically scroll the AI assistant chat window to the bottom when messages or loading states change.
 *
 * @param {React.RefObject} chatScrollRef - Ref to the scrollable container element
 * @param {Array<Object>} messages - Current message list
 * @param {boolean} isLoading - Whether an AI query is in-flight
 * @param {boolean} isOpen - Whether the AI assistant drawer is open
 *
 * @example
 * useAiChatAutoScroll(chatScrollRef, messages, false, true);
 *
 * @example
 * useAiChatAutoScroll({ current: null }, [], false, false);
 */
function useAiChatAutoScroll(chatScrollRef, messages, isLoading, isOpen) {
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isLoading, isOpen]);
}

/**
 * Hook to manage AI chat conversation history, markdown rendering, sample queries, and auto-scroll behavior.
 *
 * @param {object} options
 * @param {FamilyTree} options.tree - Family tree domain model
 * @param {Function} options.handleSetFocusId - Callback to select a person node on the canvas
 * @param {boolean} options.isLoading - Whether an AI query is actively running
 * @param {boolean} options.isOpen - Whether the AI assistant panel is currently visible
 * @returns {{
 *   messages: Array<object>,
 *   setMessages: Function,
 *   input: string,
 *   setInput: Function,
 *   chatScrollRef: React.RefObject<HTMLElement>,
 *   sampleQueries: Array<string>,
 *   renderMessage: Function
 * }}
 *
 * @example
 * const {
 *   messages,
 *   setMessages,
 *   input,
 *   setInput,
 *   chatScrollRef,
 *   sampleQueries,
 *   renderMessage
 * } = useAiChatHistory({ tree, handleSetFocusId, isLoading: false, isOpen: true });
 *
 * @example
 * // Reset input and append user message
 * setInput('');
 * setMessages(prev => [...prev, { role: 'user', text: 'Where was Joseph born?' }]);
 */
function useAiChatHistory({
    tree,
    handleSetFocusId,
    isLoading,
    isOpen
}) {
    const defaultWelcome = useMemo(() => buildDefaultAiWelcomeMessage(), []);
    const [messages, setMessages] = useState([defaultWelcome]);
    const [input, setInput] = useState('');
    const chatScrollRef = useRef(null);

    const sampleQueries = useMemo(() => buildSampleAiQueries(tree), [tree]);
    const parseText = useCallback((t, prefix = '') => parseAiMarkdownText(t, prefix, tree, handleSetFocusId), [tree, handleSetFocusId]);
    const renderMessage = useCallback((t) => renderAiMarkdownMessage(t, parseText), [parseText]);

    useAiChatAutoScroll(chatScrollRef, messages, isLoading, isOpen);

    return {
        messages,
        setMessages,
        input,
        setInput,
        chatScrollRef,
        sampleQueries,
        renderMessage
    };
}

/**
 * Triggers pending AI assistant queries queued from external controls (e.g., search bar).
 *
 * @param {string|null} pendingAiQuery - Queued query string
 * @param {Function} setPendingAiQuery - State setter to clear the pending query
 * @param {Function} submitQuery - Query execution callback
 *
 * @example
 * usePendingAiQueryTrigger('Who is John?', setPendingQuery, submitQuery);
 *
 * @example
 * usePendingAiQueryTrigger(null, () => {}, () => {});
 */
function usePendingAiQueryTrigger(pendingAiQuery, setPendingAiQuery, submitQuery) {
    useEffect(() => {
        if (pendingAiQuery && typeof pendingAiQuery === 'string' && pendingAiQuery.trim()) {
            const queryToRun = pendingAiQuery.trim();
            if (typeof setPendingAiQuery === 'function') {
                setPendingAiQuery(null);
            }
            submitQuery(queryToRun);
        }
    }, [pendingAiQuery, setPendingAiQuery, submitQuery]);
}

/**
 * Resolves active API key, executes an AI assistant query, and dispatches UI state updates.
 *
 * @param {Object} options
 * @param {string} options.userMsg - Cleaned user prompt string
 * @param {string|null} options.overrideKey - Optional temporary API key
 * @param {string} options.apiKey - Configured API key
 * @param {string} options.aiEngine - Active engine mode ('gemini' or 'internal')
 * @param {string} options.apiEnv - API environment mode
 * @param {FamilyTree} options.tree - Active family tree model
 * @param {Function} options.setAiDiagnostics - Diagnostics state setter
 * @param {Function} options.setShowSettings - Settings drawer visibility setter
 * @param {Function} options.setKeyInput - Key input field state setter
 * @param {Function} options.onAiProfilesResponded - Profile response callback
 * @param {Function} options.setMessages - Message history state setter
 * @param {Function} options.setIsLoading - Loading state setter
 * @returns {Promise<void>}
 *
 * @example
 * await processAiAssistantExecution({
 *   userMsg: 'Who is Mary?',
 *   overrideKey: null,
 *   apiKey: '',
 *   aiEngine: 'internal',
 *   apiEnv: 'auto',
 *   tree,
 *   setAiDiagnostics: () => {},
 *   setShowSettings: () => {},
 *   setKeyInput: () => {},
 *   onAiProfilesResponded: () => {},
 *   setMessages: () => {},
 *   setIsLoading: () => {}
 * });
 *
 * @example
 * await processAiAssistantExecution({
 *   userMsg: 'Test',
 *   overrideKey: 'key123',
 *   apiKey: '',
 *   aiEngine: 'gemini',
 *   apiEnv: 'prod',
 *   tree,
 *   setAiDiagnostics: () => {},
 *   setShowSettings: () => {},
 *   setKeyInput: () => {},
 *   onAiProfilesResponded: () => {},
 *   setMessages: () => {},
 *   setIsLoading: () => {}
 * });
 */
async function processAiAssistantExecution({
    userMsg, overrideKey, apiKey, aiEngine, apiEnv, tree,
    setAiDiagnostics, setShowSettings, setKeyInput,
    onAiProfilesResponded, setMessages, setIsLoading
}) {
    const runLogs = [];
    const engine = new GenealogyEngine(tree);
    const activeKey = (overrideKey || apiKey || readStoredSetting('familyTree_geminiKey')).trim();

    try {
        const outcome = await executeAiAssistantQuery({ userMsg, aiEngine, activeKey, tree, apiEnv, engine, runLogs });
        setAiDiagnostics(runLogs);
        if (outcome.requiresKeyConfig) {
            setShowSettings(true);
            setKeyInput('');
        }
        console.log('[AI Assistant Diagnostics]', runLogs);
        dispatchAiResponse({ responseText: outcome.text, isGemini: outcome.isGemini, runLogs, tree, onAiProfilesResponded, setMessages });
    } finally {
        setIsLoading(false);
    }
}

/**
 * Queues a user message in chat history and delegates to processAiAssistantExecution.
 *
 * @param {Object} options
 * @param {string} options.queryText - The raw query string submitted by user.
 * @param {string|null} [options.overrideKey=null] - Temporary override API key.
 * @param {boolean} options.isLoading - Whether an AI query is currently in progress.
 * @param {Function} options.setInput - Chat input state updater.
 * @param {Function} options.setMessages - Chat messages list updater.
 * @param {Function} options.setIsLoading - AI loading state updater.
 * @param {Object} options.config - AI assistant configuration (apiKey, aiEngine, apiEnv, etc.).
 * @param {FamilyTree} options.tree - Family tree domain model.
 * @param {Function} options.onAiProfilesResponded - Highlight callback.
 * @returns {Promise<void>}
 *
 * @example
 * await dispatchAiAssistantUserQuery({
 *   queryText: 'Find Bob',
 *   overrideKey: null,
 *   isLoading: false,
 *   setInput: () => {},
 *   setMessages: () => {},
 *   setIsLoading: () => {},
 *   config: {},
 *   tree: null,
 *   onAiProfilesResponded: () => {}
 * });
 *
 * @example
 * await dispatchAiAssistantUserQuery({
 *   queryText: '',
 *   overrideKey: null,
 *   isLoading: true,
 *   setInput: () => {},
 *   setMessages: () => {},
 *   setIsLoading: () => {},
 *   config: {},
 *   tree: null,
 *   onAiProfilesResponded: () => {}
 * });
 */
async function dispatchAiAssistantUserQuery({
    queryText, overrideKey = null, isLoading, setInput,
    setMessages, setIsLoading, config, tree, onAiProfilesResponded
}) {
    if (!queryText.trim() || isLoading) return;

    const userMsg = queryText.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    const { apiKey, aiEngine, apiEnv, setShowSettings, setKeyInput, setAiDiagnostics } = config;
    await processAiAssistantExecution({
        userMsg, overrideKey, apiKey, aiEngine, apiEnv, tree,
        setAiDiagnostics, setShowSettings, setKeyInput,
        onAiProfilesResponded, setMessages, setIsLoading
    });
}

/**
 * Hook providing memoized asynchronous query dispatch callback for the AI assistant.
 *
 * @param {Object} params
 * @param {boolean} params.isLoading - Current query loading indicator.
 * @param {Function} params.setInput - Setter for query input text.
 * @param {Function} params.setMessages - Setter for chat message history.
 * @param {Function} params.setIsLoading - Setter for query loading state.
 * @param {Object} params.config - AI assistant client settings and active model config.
 * @param {FamilyTree} params.tree - FamilyTree data model.
 * @param {Function} [params.onAiProfilesResponded] - Callback invoked with mentioned profile IDs.
 * @returns {Function} Memoized async function to execute AI query submission.
 *
 * @example
 * const submit = useAiQueryDispatcher({ isLoading: false, setInput: () => {}, setMessages: () => {}, setIsLoading: () => {}, config: {}, tree: null });
 *
 * @example
 * const submit = useAiQueryDispatcher({ isLoading: true, setInput: () => {}, setMessages: () => {}, setIsLoading: () => {}, config: {}, tree: null });
 * submit('test query');
 */
function useAiQueryDispatcher({
    isLoading,
    setInput,
    setMessages,
    setIsLoading,
    config,
    tree,
    onAiProfilesResponded
}) {
    return useCallback(async (queryText, overrideKey = null) => {
        await dispatchAiAssistantUserQuery({
            queryText,
            overrideKey,
            isLoading,
            setInput,
            setMessages,
            setIsLoading,
            config,
            tree,
            onAiProfilesResponded
        });
    }, [isLoading, setIsLoading, tree, config, onAiProfilesResponded, setInput, setMessages]);
}

/**
 * Hook to manage AI query execution lifecycle, pending query triggers, and form submission.
 *
 * @param {object} options
 * @param {object} options.config - AI assistant configuration from useAiAssistantConfig
 * @param {object} options.chatHistory - AI chat history state from useAiChatHistory
 * @param {FamilyTree} options.tree - Family tree domain model
 * @param {boolean} options.isLoading - Whether an AI query is currently running
 * @param {Function} options.setIsLoading - State setter for loading status
 * @param {Function} [options.onAiProfilesResponded] - Callback invoked when profile matches are returned
 * @param {string|null} options.pendingAiQuery - Pending external query to run automatically
 * @param {Function} options.setPendingAiQuery - State setter to clear or update the pending query
 * @returns {{
 *   submitQuery: Function,
 *   handleAsk: Function
 * }}
 *
 * @example
 * const { submitQuery, handleAsk } = useAiQuerySubmission({
 *   config,
 *   chatHistory,
 *   tree,
 *   isLoading: false,
 *   setIsLoading: () => {},
 *   onAiProfilesResponded: () => {},
 *   pendingAiQuery: null,
 *   setPendingAiQuery: () => {}
 * });
 *
 * @example
 * // Submit an ad-hoc query
 * submitQuery("Who is the oldest ancestor in the tree?");
 */
function useAiQuerySubmission({
    config, chatHistory, tree, isLoading,
    setIsLoading, onAiProfilesResponded, pendingAiQuery, setPendingAiQuery
}) {
    const { input, setInput, setMessages } = chatHistory;
    const submitQuery = useAiQueryDispatcher({
        isLoading, setInput, setMessages, setIsLoading, config, tree, onAiProfilesResponded
    });

    usePendingAiQueryTrigger(pendingAiQuery, setPendingAiQuery, submitQuery);

    const handleAsk = useCallback((e) => {
        e.preventDefault();
        submitQuery(input);
    }, [input, submitQuery]);

    return { submitQuery, handleAsk };
}

/**
 * Custom hook to manage AI Assistant session state, query submission lifecycle,
 * settings drawers, chat messages history, and connection diagnostics.
 *
 * @param {Object} options
 * @param {FamilyTree} options.tree - The current FamilyTree dataset.
 * @param {Function} options.handleSetFocusId - Callback to select a person node on the tree canvas.
 * @param {boolean} options.isLoading - Whether an AI query or analysis is currently in progress.
 * @param {Function} options.setIsLoading - Setter for loading status.
 * @param {Function} [options.onAiProfilesResponded] - Callback invoked when mentioned profiles are returned.
 * @param {string|null} options.pendingAiQuery - An external pending query waiting to be submitted.
 * @param {Function} options.setPendingAiQuery - Setter to clear or update the pending query.
 * @param {boolean} options.isOpen - Whether the AI Assistant panel is currently open.
 * @returns {{
 *   apiKey: string,
 *   setApiKey: Function,
 *   apiEnv: string,
 *   setApiEnv: Function,
 *   aiEngine: string,
 *   handleSelectEngine: Function,
 *   showSettings: boolean,
 *   setShowSettings: Function,
 *   keyInput: string,
 *   setKeyInput: Function,
 *   aiDiagnostics: Array,
 *   showDiag: boolean,
 *   setShowDiag: Function,
 *   testStatus: Object|null,
 *   handleTestConnection: Function,
 *   messages: Array,
 *   input: string,
 *   setInput: Function,
 *   chatScrollRef: React.RefObject<HTMLElement>,
 *   sampleQueries: Array,
 *   renderMessage: Function,
 *   submitQuery: Function,
 *   handleAsk: Function
 * }}
 *
 * @example
 * const session = useAiAssistantSession({
 *   tree,
 *   handleSetFocusId,
 *   isLoading,
 *   setIsLoading,
 *   onAiProfilesResponded,
 *   pendingAiQuery,
 *   setPendingAiQuery,
 *   isOpen
 * });
 *
 * @example
 * // Trigger an automated question through session
 * session.submitQuery("Who is the oldest ancestor in the tree?");
 */
function useAiAssistantSession({
    tree, handleSetFocusId, isLoading, setIsLoading,
    onAiProfilesResponded, pendingAiQuery, setPendingAiQuery, isOpen
}) {
    const config = useAiAssistantConfig();
    const chatHistory = useAiChatHistory({ tree, handleSetFocusId, isLoading, isOpen });
    const { submitQuery, handleAsk } = useAiQuerySubmission({
        config, chatHistory, tree, isLoading, setIsLoading,
        onAiProfilesResponded, pendingAiQuery, setPendingAiQuery
    });

    return {
        ...config,
        ...chatHistory,
        submitQuery,
        handleAsk
    };
}

/**
 * Renders the scrollable list of chat message bubbles and loading indicator in the AI assistant panel.
 *
 * @param {object} props
 * @param {React.RefObject<HTMLElement>} props.chatScrollRef - Ref attached to the scroll container
 * @param {Array<object>} props.messages - Array of chat message objects
 * @param {Function} props.renderMessage - Function to render markdown content
 * @param {Array<string>} props.sampleQueries - Sample questions suggested in the welcome message
 * @param {Function} props.onSubmitQuery - Callback to submit a selected query
 * @param {boolean} props.isLoading - Whether an AI query is currently in progress
 * @returns {React.ReactNode}
 *
 * @example
 *   <AiChatMessagesContainer
 *     chatScrollRef={chatScrollRef}
 *     messages={[{ role: 'ai', text: 'Hello' }]}
 *     renderMessage={(t) => t}
 *     sampleQueries={['Who is John?']}
 *     onSubmitQuery={() => {}}
 *     isLoading={false}
 *   />
 *
 * @example
 *   <AiChatMessagesContainer
 *     chatScrollRef={{ current: null }}
 *     messages={[]}
 *     renderMessage={fn}
 *     sampleQueries={[]}
 *     onSubmitQuery={fn}
 *     isLoading={true}
 *   />
 */
const AiChatMessagesContainer = ({
    chatScrollRef,
    messages,
    renderMessage,
    sampleQueries,
    onSubmitQuery,
    isLoading
}) => (
    <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5 text-[13px] bg-slate-50/50 custom-scrollbar">
        {messages.map((m, i) => (
            <AiMessageBubble
                key={i}
                message={m}
                renderMessage={renderMessage}
                sampleQueries={sampleQueries}
                onSubmitQuery={onSubmitQuery}
            />
        ))}
        {isLoading && (
            <div className="p-3.5 rounded-2xl bg-white text-slate-500 self-start rounded-tl-sm border border-slate-200 shadow-sm flex items-center gap-2 font-medium">
                <Icons.Loader /> Analyzing tree with AI...
            </div>
        )}
    </div>
);

/**
 * Renders the top configuration controls for the AI assistant, including engine toggle,
 * diagnostics drawer, and AI Studio settings drawer.
 *
 * @param {object} props
 * @param {object} props.session - AI assistant session state and dispatchers
 * @returns {React.ReactNode} Top configuration controls
 *
 * @example
 * <AiAssistantConfigPanels session={session} />
 *
 * @example
 * const panels = <AiAssistantConfigPanels session={activeSession} />;
 */
const AiAssistantConfigPanels = ({ session }) => (
    <>
        <AiEngineToggle
            aiEngine={session.aiEngine} apiKey={session.apiKey}
            handleSelectEngine={session.handleSelectEngine}
            hasDiagnostics={session.aiDiagnostics.length > 0}
            showDiag={session.showDiag} setShowDiag={session.setShowDiag}
            showSettings={session.showSettings} setShowSettings={session.setShowSettings}
            setKeyInput={session.setKeyInput}
        />
        <AiDiagnosticsDrawer showDiag={session.showDiag} setShowDiag={session.setShowDiag} aiDiagnostics={session.aiDiagnostics} />
        <AiStudioSettingsDrawer
            showSettings={session.showSettings} setShowSettings={session.setShowSettings}
            keyInput={session.keyInput} setKeyInput={session.setKeyInput}
            apiKey={session.apiKey} setApiKey={session.setApiKey}
            apiEnv={session.apiEnv} setApiEnv={session.setApiEnv}
            aiEngine={session.aiEngine} handleSelectEngine={session.handleSelectEngine}
            handleTestConnection={session.handleTestConnection} testStatus={session.testStatus}
        />
    </>
);

/**
 * AI assistant side panel providing conversational genealogy deduction, Gemini model querying,
 * connection configuration, and diagnostics logging.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the AI assistant panel is visible
 * @param {Function} props.setIsOpen - State setter for panel visibility
 * @param {FamilyTree} props.tree - Loaded family tree domain model
 * @param {Function} props.handleSetFocusId - Callback to select a person node on the canvas
 * @param {boolean} props.isLoading - Whether a query is actively running
 * @param {Function} props.setIsLoading - State setter for loading state
 * @param {Function} [props.onAiProfilesResponded] - Callback invoked when profile IDs are detected
 * @param {string|null} props.pendingAiQuery - External query queued for execution
 * @param {Function} props.setPendingAiQuery - State setter for pending external query
 * @returns {React.ReactNode}
 *
 * @example
 *   <AIAssistant
 *     isOpen={true}
 *     setIsOpen={() => {}}
 *     tree={tree}
 *     handleSetFocusId={() => {}}
 *     isLoading={false}
 *     setIsLoading={() => {}}
 *     onAiProfilesResponded={() => {}}
 *     pendingAiQuery={null}
 *     setPendingAiQuery={() => {}}
 *   />
 *
 * @example
 *   <AIAssistant
 *     isOpen={false}
 *     setIsOpen={fn}
 *     tree={null}
 *     handleSetFocusId={fn}
 *     isLoading={true}
 *     setIsLoading={fn}
 *   />
 */
const AIAssistant = ({ isOpen, setIsOpen, tree, handleSetFocusId, isLoading, setIsLoading, onAiProfilesResponded, pendingAiQuery, setPendingAiQuery }) => {
    const session = useAiAssistantSession({
        tree, handleSetFocusId, isLoading, setIsLoading,
        onAiProfilesResponded, pendingAiQuery, setPendingAiQuery, isOpen
    });

    return (
        <div className={`flex flex-col h-full w-full pt-[124px] ${isOpen ? '' : 'hidden'}`}>
            <AiAssistantConfigPanels session={session} />
            <AiChatMessagesContainer
                chatScrollRef={session.chatScrollRef}
                messages={session.messages}
                renderMessage={session.renderMessage}
                sampleQueries={session.sampleQueries}
                onSubmitQuery={session.submitQuery}
                isLoading={isLoading}
            />
            <AiAssistantInputForm
                input={session.input}
                setInput={session.setInput}
                onSubmit={session.handleAsk}
                isLoading={isLoading}
                aiEngine={session.aiEngine}
            />
        </div>
    );
};

const COUNTRY_FLAGS = {
    'India': '🇮🇳',
    'United States': '🇺🇸',
    'United Kingdom': '🇬🇧',
    'United Arab Emirates': '🇦🇪',
    'Australia': '🇦🇺',
    'Singapore': '🇸🇬',
    'Canada': '🇨🇦',
    'Germany': '🇩🇪',
    'Qatar': '🇶🇦',
    'Kuwait': '🇰🇼',
    'Oman': '🇴🇲',
    'Bahrain': '🇧🇭',
    'Saudi Arabia': '🇸🇦',
    'Ireland': '🇮🇪',
    'Switzerland': '🇨🇭',
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'New Zealand': '🇳🇿',
    'Middle East': '🌴',
    'Other': '🌐'
};

const LOCATION_GEO_HIERARCHY = {
    ...FamilyTreeBuilder._expandGeoHierarchy({
        'India.Kerala.Thrissur': [
            'ollur', 'thalore', 'thoyakkavu', 'thrissur', 'trichur', 'potta', 'pota',
            'aranattukara', 'puthur', 'west chalakkudy', 'west chalakudy', 'chalakkudy',
            'chalakudy', 'chiklai', 'porthur', 'porathur', 'pavaratty', 'kalathodu',
            'melur', 'meloor', 'thaikkattussery', 'pudukad', 'puthukkad',
            'vellikkulangara', 'kombidi', 'chelakkara', 'arimboor', 'edathirithi',
            'edathiruthi', 'chittattukara', 'chittatukara', 'kundannur', 'anandapuram',
            'pazhuvil', 'peringavu', 'kuttikkad', 'kuttikad', 'varantharappilli',
            'aloor', 'മാള', 'mala', 'chovoor', 'kandasamkadavu', 'kuttoor',
            'kuttoor, thrissur', 'nellankara', 'nellankara, thrissur', 'amballur',
            'cheerachi', 'chembukkavu', 'cherpu', 'irinjalakuda', 'irinjalakkuda',
            'kaduppassery', 'kainoor', 'kallettumkara', 'kodakara', 'kodungallur',
            'koratty', 'kunnamkulam', 'kuriachira', 'kuriyachira', 'kuttanellur',
            'mannuthy', 'marathakkara', 'mathilakam', 'muriyad', 'nandikkara',
            'nattika', 'ollukkara', 'palakkal', 'pattikkad', 'pazhayannur',
            'perinjanam', 'puzhakkal', 'triprayar', 'thriprayar', 'urakam',
            'valapad', 'vellanikkara', 'velookkara', 'viyyur', 'wadakkanchery',
            'guruvayur', 'chavakkad', 'ayyanthole', 'peruvamkulangara', 'perambra',
            'perambra, thrissur', 'konikkara', 'padavaradu', 'padavarad',
            'near st raphaels', 'st raphaels', 'pariyaram', 'amballoor'
        ],
        'India.Kerala.Ernakulam': [
            'ernakulam', 'vaitila', 'vyttila', 'cochin', 'kochi', 'kaloor',
            'വൈപ്പിൻ, കണക്കൻകടവ്', 'vypin', 'അങ്കമാലി', 'angamaly', 'angamali',
            'kootappuzha', 'kalamassery', 'aluva', 'edappally', 'kakkanad',
            'maradu', 'mattancherry', 'north paravur', 'palarivattom',
            'panampilly nagar', 'perumbavoor', 'thevara', 'tripunithura',
            'varapuzha', 'champannoor', 'champannur', 'thoppumpadi', 'thoppumpady'
        ],
        'India.Kerala.Kottayam': [
            'palai', 'pala', 'kanjirathanam', 'moonilavu', 'kottayam', 'neeloor',
            'bharananganam', 'poonjaar', 'poonjar', 'kadanaadu', 'kadanad',
            'ezhacheri', 'ezhacherry', 'ramapuram', 'melukavu', 'melukavumattom'
        ],
        'India.Kerala.Idukki': [
            'velliyamattom', 'velliyaamattam', 'idukki', 'thodupuzha'
        ],
        'India.Kerala.Palakkad': [
            'palakkad', 'palghat', 'shoranur', 'ottapalam', 'alathur'
        ],
        'India.Kerala.Kozhikode': ['calicut', 'kozhikode'],
        'India.Kerala.Kannur': ['kannur'],
        'India.Kerala.Kollam': ['kollam'],
        'India.Kerala.Alappuzha': ['alappuzha', 'alleppey'],
        'India.Kerala.Thiruvananthapuram': ['trivandrum', 'thiruvananthapuram'],
        'India.Kerala.Kerala': ['kerala'],
        'India.Karnataka.': ['bangalore', 'bengaluru', 'mangalore', 'mysore'],
        'India.Tamil Nadu.': [
            'trichy', 'thrisnapalli', 'tiruchirappalli', 'mettupalayam',
            'coimbatore', 'coimbathur', 'chennai', 'madras', 'madurai'
        ],
        'India.Telangana.': ['telangana', 'hyderabad'],
        'India.Maharashtra.': ['bombay', 'mumbai', 'pune'],
        'India..': ['india'],
        'United States.California.': ['california', 'san jose', 'san francisco'],
        'United States.Texas.': ['texas', 'dallas', 'houston'],
        'United States.Washington DC.': ['washington dc'],
        'United States.Washington.': [
            'washington', 'washington state', 'seattle', 'seattle, washington',
            'seattle, wa', 'seattle, california'
        ],
        'United States.Florida.': ['naples, florida', 'naples', 'florida'],
        'United States.Illinois.': ['chicago', 'illinois'],
        'United States.New York.': ['new york'],
        'United States.Massachusetts.': ['boston'],
        'United States.Georgia.': ['atlanta'],
        'United States..': ['usa', 'us', 'united states'],
        'United Kingdom.England.': ['london', 'birmingham', 'england'],
        'United Kingdom.Scotland.': ['edinburgh'],
        'United Kingdom..': ['uk', 'united kingdom'],
        'Middle East..': ['gulf', 'middle east'],
        'United Arab Emirates..': ['dubai', 'abu dhabi', 'sharjah', 'uae'],
        'Qatar..': ['qatar', 'doha'],
        'Kuwait..': ['kuwait'],
        'Oman..': ['oman'],
        'Bahrain..': ['bahrain'],
        'Saudi Arabia..': ['saudi arabia'],
        'Singapore..': ['singapore'],
        'Australia.Western Australia.': ['perth'],
        'Australia.New South Wales.': ['sydney'],
        'Australia.Victoria.': ['melbourne'],
        'Australia.Queensland.': ['brisbane'],
        'Australia..': ['australia'],
        'Canada..': ['canada'],
        'Canada.Ontario.': ['toronto'],
        'Canada.British Columbia.': ['vancouver'],
        'Canada.Quebec.': ['montreal'],
        'Germany..': ['germany', 'berlin', 'munich'],
        'New Zealand..': ['new zealand'],
        'Ireland..': ['ireland', 'dublin'],
        'Switzerland..': ['switzerland'],
        'France..': ['france', 'paris'],
        'Italy..': ['italy']
    })
};

const SORTED_GEO_ENTRIES = Object.entries(LOCATION_GEO_HIERARCHY).sort((a, b) => b[0].length - a[0].length);

/**
 * Searches a geographic Trie index for direct or longest-prefix matches across a normalized place name and its tokens.
 *
 * @param {Object} trie - Prefix trie instance
 * @param {string} norm - Full normalized place string
 * @param {Array<string>} tokens - Delimited sub-tokens
 * @returns {Object|null} Matching geographic hierarchy or null
 *
 * @example
 * const match = _matchGeoTrie(trie, 'thrissur', ['thrissur']);
 *
 * @example
 * const match = _matchGeoTrie(trie, 'unknownplace', ['unknownplace']);
 */
const _matchGeoTrie = (trie, norm, tokens) => {
    if (!trie) return null;
    const directMatch = trie.search(norm) || trie.longestPrefixMatch(norm);
    if (directMatch) return directMatch;
    for (const token of tokens) {
        const tokMatch = trie.search(token) || trie.longestPrefixMatch(token);
        if (tokMatch) return tokMatch;
    }
    return null;
};

/**
 * Scans sorted geographic entries for whole-word regex matches followed by substring fallback matches.
 *
 * @param {string} norm - Normalized place string
 * @returns {Object|null} Matching geographic entry value or null
 *
 * @example
 * const match = _matchSortedGeoEntries('kerala');
 *
 * @example
 * const match = _matchSortedGeoEntries('nonexistent place');
 */
const _matchSortedGeoEntries = (norm) => {
    for (const [k, v] of SORTED_GEO_ENTRIES) {
        const regex = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(norm)) return v;
    }
    for (const [k, v] of SORTED_GEO_ENTRIES) {
        if (k.length > 3 && (norm.includes(k) || k.includes(norm))) return v;
    }
    return null;
};

/**
 * Resolves country, state, and district metadata for a given location string.
 * 
 * @param {string} place - Raw location name (e.g. "Thrissur", "San Jose, California")
 * @returns {{ country: string, state: string|null, district: string|null }}
 * 
 * @example
 * resolvePlaceHierarchy("Thrissur");
 * // => { country: "India", state: "Kerala", district: "Thrissur" }
 * 
 * @example
 * resolvePlaceHierarchy("Seattle, WA");
 * // => { country: "United States", state: "Washington", district: null }
 */
const resolvePlaceHierarchy = (place) => {
    if (!place || FamilyTreeBuilder.isInvalidLocation(place)) return { country: 'Other', state: null, district: null };
    const norm = place.toLowerCase().trim();
    if (LOCATION_GEO_HIERARCHY[norm]) return LOCATION_GEO_HIERARCHY[norm];

    // Check individual comma/slash separated tokens first
    const tokens = norm.split(/[,/]/).map(s => s.trim()).filter(Boolean);
    for (const token of tokens) {
        if (LOCATION_GEO_HIERARCHY[token]) return LOCATION_GEO_HIERARCHY[token];
    }

    // Trie spatial lookup supporting phonetic transliteration and prefix matching
    const trie = FamilyTreeBuilder.getGeoTrie(LOCATION_GEO_HIERARCHY);
    const trieMatch = _matchGeoTrie(trie, norm, tokens);
    if (trieMatch) return trieMatch;

    const entryMatch = _matchSortedGeoEntries(norm);
    if (entryMatch) return entryMatch;

    return { country: 'Other', state: null, district: null };
};
FamilyTreeBuilder.resolvePlaceHierarchy = resolvePlaceHierarchy;
FamilyTreeBuilder.LOCATION_GEO_HIERARCHY = LOCATION_GEO_HIERARCHY;
if (typeof window !== 'undefined') {
    window.resolvePlaceHierarchy = resolvePlaceHierarchy;
    window.LOCATION_GEO_HIERARCHY = LOCATION_GEO_HIERARCHY;
}

// ============================================================================
// OMNI SEARCH HELPERS & CLASSIFIER
// ============================================================================

/**
 * Detects if a query string should trigger the AI assistant instead of direct search.
 * 
 * @param {string} q - Raw trimmed query
 * @param {string} qLower - Lowercase query
 * @returns {boolean} True if query matches question or conversational phrasing patterns
 * 
 * @example
 * _isAiAssistantQuery('Who is Mary?', 'who is mary?');
 * // => true
 * 
 * @example
 * _isAiAssistantQuery('Mary', 'mary');
 * // => false
 */
function _isAiAssistantQuery(q, qLower) {
    const isQuestionWord = /^(who|what|when|where|why|how|which|tell|describe|find\s+out|is\s+there|are\s+there|list\s+all|can\s+you|show\s+me)\b/i.test(qLower);
    const hasQuestionMark = q.includes('?');
    const isRelationalPhrase = /\b(children\s+of|child\s+of|spouse\s+of|husband\s+of|wife\s+of|father\s+of|mother\s+of|parents\s+of|related\s+to|relationship\s+between|oldest\s+in|youngest\s+in|born\s+in|died\s+in|lived\s+in|who\s+is|who\s+was|who\s+are|who\s+were)\b/i.test(qLower);
    const hasPossessiveQuery = /['’]s\s+(children|child|kids|spouse|husband|wife|father|mother|parents|siblings|brother|sister|son|daughter|job|career|place)\b/i.test(qLower);
    const isMultiWordQuestion = qLower.split(/\s+/).length >= 4;
    return isQuestionWord || hasQuestionMark || isRelationalPhrase || hasPossessiveQuery || isMultiWordQuestion;
}

/**
 * Detects if a query targets a known location map view and counts matching residents.
 * 
 * @param {string} q - Raw query
 * @param {string} qLower - Lowercase query
 * @param {FamilyTree} tree - Populated tree instance
 * @returns {{ type: 'location', place: string, count: number, query: string } | null}
 * 
 * @example
 * _matchOmniLocation('in Chicago', 'in chicago', tree);
 * // => { type: 'location', place: 'Chicago', count: 3, query: 'in Chicago' }
 * 
 * @example
 * _matchOmniLocation('John', 'john', tree);
 * // => null
 */
function _matchOmniLocation(q, qLower, tree) {
    const cleanPlaceQuery = qLower.replace(/^(?:in|at|from|to|near|location:?)\s+/i, '').trim();
    const places = Array.from(new Set(tree.all.map(p => p.place).filter(Boolean).map(pl => pl.trim()).filter(pl => !FamilyTreeBuilder.isInvalidLocation(pl))));
    
    // Direct place match
    const exactPlace = places.find(pl => pl.toLowerCase() === cleanPlaceQuery || pl.toLowerCase() === qLower);
    if (exactPlace) {
        const residents = tree.all.filter(p => !p.isGhost && !p._isUnknown && p.place && p.place.toLowerCase().includes(exactPlace.toLowerCase()));
        return { type: 'location', place: exactPlace, count: residents.length, query: q };
    }

    if (cleanPlaceQuery.length >= 3) {
        const matchedPlace = places.find(pl => pl.toLowerCase().includes(cleanPlaceQuery));
        if (matchedPlace) {
            const isExplicitLocation = /^(?:in|at|from|to|near|location:?)\s+/i.test(qLower);
            const residents = tree.all.filter(p => !p.isGhost && !p._isUnknown && p.place && p.place.toLowerCase().includes(matchedPlace.toLowerCase()));
            if (isExplicitLocation || residents.length > 0) {
                return { type: 'location', place: matchedPlace, count: residents.length, query: q };
            }
        }
    }
    return null;
}

/**
 * Matches tree profiles and jobs against a query string for omni-search classification.
 *
 * @param {string} q - Trimmed query string
 * @param {string} qLower - Lowercase query string
 * @param {FamilyTree} tree - The populated family tree instance
 * @returns {{ type: string, people?: Object[], jobs?: string[], query: string }}
 *
 * @example
 * _matchOmniProfilesAndJobs('Engineer', 'engineer', tree);
 * // => { type: 'profile', people: [...], jobs: ['Engineer'], query: 'Engineer' }
 *
 * @example
 * _matchOmniProfilesAndJobs('Unknown', 'unknown', tree);
 * // => { type: 'profile', query: 'Unknown' }
 */
function _matchOmniProfilesAndJobs(q, qLower, tree) {
    const people = tree.all.filter(p => !p.isGhost && !p._isUnknown && (
        p.name.toLowerCase().includes(qLower) || (p.nick && p.nick.toLowerCase().includes(qLower))
    ));
    const jobs = Array.from(new Set(tree.all.map(p => p.job).filter(Boolean).map(j => j.trim())))
        .filter(j => j.toLowerCase().includes(qLower));

    if (people.length > 0 || jobs.length > 0) {
        return { type: 'profile', people, jobs, query: q };
    }
    return { type: 'profile', query: q };
}

/**
 * Classifies an omni search query into an intent ('ai', 'location', 'profile', or 'empty').
 * 
 * @param {string} query - Raw search query entered by the user
 * @param {FamilyTree} tree - Populated tree instance
 * @returns {{ type: string, query?: string, place?: string, count?: number, people?: Object[], jobs?: string[] }} Classified intent
 * 
 * @example
 * classifyOmniQuery('Who was Mary?', tree);
 * // => { type: 'ai', query: 'Who was Mary?' }
 * 
 * @example
 * classifyOmniQuery('in Kerala', tree);
 * // => { type: 'location', place: 'Kerala', count: 12, query: 'in Kerala' }
 */
const classifyOmniQuery = (query, tree) => {
    if (!query || !query.trim() || !tree) return { type: 'empty' };
    const q = query.trim();
    const qLower = q.toLowerCase();

    if (_isAiAssistantQuery(q, qLower)) return { type: 'ai', query: q };
    const locMatch = _matchOmniLocation(q, qLower, tree);
    if (locMatch) return locMatch;

    return _matchOmniProfilesAndJobs(q, qLower, tree);
};

/**
 * Comparator to rank search matches (real profiles first, prefix matches before substring, ordered by birth year).
 * 
 * @param {Object} a - Person A
 * @param {Object} b - Person B
 * @param {string} queryLower - Search query in lowercase
 * @returns {number} Negative if a should precede b, positive if b should precede a, zero if equal
 * 
 * @example
 * [personB, personA].sort((a, b) => _compareSearchCandidates(a, b, 'mary'));
 * // => [personA, personB] (prefix match first)
 * 
 * @example
 * _compareSearchCandidates(realPerson, ghostPerson, 'john');
 * // => -1 (real profiles prioritized over ghosts)
 */
function _compareSearchCandidates(a, b, queryLower) {
    const aReal = !a.isGhost ? 1 : 0;
    const bReal = !b.isGhost ? 1 : 0;
    if (aReal !== bReal) return bReal - aReal;

    const aStarts = a.name.toLowerCase().startsWith(queryLower);
    const bStarts = b.name.toLowerCase().startsWith(queryLower);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    const aNickStarts = a.nick && a.nick.toLowerCase().startsWith(queryLower);
    const bNickStarts = b.nick && b.nick.toLowerCase().startsWith(queryLower);
    if (aNickStarts !== bNickStarts) return aNickStarts ? -1 : 1;

    const yobA = a.yob || a._inferredYob || 9999;
    const yobB = b.yob || b._inferredYob || 9999;
    if (yobA !== yobB) return yobA - yobB;

    return a.name.localeCompare(b.name);
}

/**
 * Generates omnibar shortcut actions (AI assistant, location maps, career filters).
 * 
 * @param {string} queryText - Trimmed raw query
 * @param {string} normValue - Lowercase query
 * @param {FamilyTree} tree - Tree instance
 * @returns {Array<Object>} Shortcut items
 * 
 * @example
 * _buildSearchShortcuts('Kerala', 'kerala', tree);
 * // => [{ id: 'shortcut-ai', type: 'ai', ... }, { id: 'shortcut-loc-Kerala', type: 'location', place: 'Kerala', ... }]
 * 
 * @example
 * _buildSearchShortcuts('Teacher', 'teacher', tree);
 * // => [{ id: 'shortcut-ai', type: 'ai', ... }, { id: 'shortcut-job-Teacher', type: 'job', job: 'Teacher', ... }]
 */
function _buildSearchShortcuts(queryText, normValue, tree) {
    const items = [{ id: 'shortcut-ai', type: 'ai', query: queryText, title: `Ask AI Assistant: "${queryText}"` }];

    const places = Array.from(new Set(tree.all.map(p => p.place).filter(Boolean).map(pl => pl.trim())));
    const matchedPlace = places.find(pl => pl.toLowerCase().includes(normValue) || normValue.includes(pl.toLowerCase()));
    if (matchedPlace) {
        items.push({ id: `shortcut-loc-${matchedPlace}`, type: 'location', place: matchedPlace, title: `Explore "${matchedPlace}" on Map` });
    }

    const jobs = Array.from(new Set(tree.all.map(p => p.job).filter(Boolean).map(j => j.trim())));
    const matchedJob = jobs.find(j => j.toLowerCase().includes(normValue));
    if (matchedJob && matchedJob.toLowerCase() !== normValue) {
        items.push({ id: `shortcut-job-${matchedJob}`, type: 'job', job: matchedJob, title: `Filter Career: "${matchedJob}"` });
    }

    return items;
}

/**
 * Searches and ranks person profiles matching the omnibar query.
 * 
 * @param {FamilyTree} tree - Populated family tree instance
 * @param {string} normValue - Lowercase search string
 * @returns {Object[]} Ranked person profiles
 * 
 * @example
 * _findMatchingSearchPeople(tree, 'mary');
 * // => [Person('Mary')]
 * 
 * @example
 * _findMatchingSearchPeople(tree, 'nonexistent');
 * // => []
 */
function _findMatchingSearchPeople(tree, normValue) {
    return tree.all.filter(p => {
        if (p._isUnknown || FamilyTree.isSyntheticSiblingParent(p)) return false;
        return matchesPersonSearch(p, normValue);
    }).sort((a, b) => _compareSearchCandidates(a, b, normValue));
}

/**
 * Compiles a list of omnibar search items including query shortcuts and matching person profiles.
 * 
 * @param {string} query - Raw search query
 * @param {FamilyTree} tree - Populated family tree instance
 * @returns {Array<{ id: string, type: string, [key: string]: any }>} Combined search shortcut and profile items
 * 
 * @example
 * getSearchItems('Mary', tree);
 * // => [{ id: 'shortcut-ai', type: 'ai', ... }, { id: 'person-p1', type: 'person', person: ... }]
 * 
 * @example
 * getSearchItems('', tree);
 * // => []
 */
const getSearchItems = (query, tree) => {
    if (!query || !query.trim() || !tree) return [];
    const normValue = query.trim().toLowerCase();
    const shortcuts = _buildSearchShortcuts(query.trim(), normValue, tree);
    const peopleItems = _findMatchingSearchPeople(tree, normValue).map(p => ({
        id: `person-${p.id}`,
        type: 'person',
        person: p
    }));
    return [...shortcuts, ...peopleItems];
};

/**
 * Determines the initial active item index in the omnibar results list based on query intent.
 * 
 * @param {Array<Object>} items - Search result items
 * @param {{ type: string }} intent - Classified query intent
 * @returns {number} Default item index to highlight
 * 
 * @example
 * getDefaultSelectedIndex([{ type: 'ai' }, { type: 'person' }], { type: 'ai' });
 * // => 0
 * 
 * @example
 * getDefaultSelectedIndex([{ type: 'ai' }, { type: 'person' }], { type: 'profile' });
 * // => 1
 */
const getDefaultSelectedIndex = (items, intent) => {
    if (!items || items.length === 0) return 0;
    if (intent?.type === 'ai') {
        const aiIdx = items.findIndex(it => it.type === 'ai');
        return aiIdx >= 0 ? aiIdx : 0;
    }
    if (intent?.type === 'location') {
        const locIdx = items.findIndex(it => it.type === 'location');
        return locIdx >= 0 ? locIdx : 0;
    }
    // Profile mode: find first person item if available, otherwise first item
    const personIdx = items.findIndex(it => it.type === 'person');
    return personIdx >= 0 ? personIdx : 0;
};

/**
 * Evaluates whether a location string or its geographic hierarchy matches a normalized place query.
 *
 * Checks direct substring inclusion in both directions (e.g. 'kochi' in 'kochi, kerala'), as well as
 * resolved hierarchical components (country, state, district).
 *
 * @param {string|null|undefined} place - Raw place name from person profile
 * @param {string} normValue - Lowercase, trimmed query value
 * @returns {boolean}
 *
 * @example
 * matchesPlaceFilter('Ernakulam, Kerala', 'kerala')
 * // => true
 *
 * @example
 * matchesPlaceFilter('Kochi', 'india')
 * // => true
 *
 * @example
 * matchesPlaceFilter('', 'kerala')
 * // => false
 */
function matchesPlaceFilter(place, normValue) {
    if (!place) return false;
    const pNorm = place.toLowerCase().trim();
    if (pNorm.includes(normValue) || normValue.includes(pNorm)) return true;
    const geo = resolvePlaceHierarchy(place);
    if (!geo) return false;
    return Boolean(
        (geo.country && geo.country.toLowerCase() === normValue) ||
        (geo.state && geo.state.toLowerCase() === normValue) ||
        (geo.district && geo.district.toLowerCase() === normValue)
    );
}

/**
 * Evaluates whether any searchable attribute of a person (name, nick, family, job, place)
 * contains the normalized query substring.
 *
 * @param {Person} p - Person model instance
 * @param {string} normValue - Lowercase query substring
 * @returns {boolean}
 *
 * @example
 * matchesPersonSearch(person, 'john');
 * // => true
 * 
 * @example
 * matchesPersonSearch(person, 'nonexistent');
 * // => false
 */
function matchesPersonSearch(p, normValue) {
    return Boolean(
        (p.name && p.name.toLowerCase().includes(normValue)) ||
        (p.nick && p.nick.toLowerCase().includes(normValue)) ||
        (p.family && p.family.toLowerCase().includes(normValue)) ||
        (p.job && p.job.toLowerCase().includes(normValue)) ||
        (p.place && p.place.toLowerCase().includes(normValue))
    );
}

/**
 * Determines whether a person matches an active filter criterion (family, job, place, or search).
 *
 * Excludes ghost and unknown nodes. For 'place', checks both direct match and resolved
 * geographic hierarchy (country, state, district).
 *
 * @param {Person} p - Person model instance to test
 * @param {string} filterType - Type of filter ('family' | 'job' | 'place' | 'search')
 * @param {string} normValue - Lowercase, trimmed query or filter value
 * @returns {boolean} True if person matches the filter criteria
 * 
 * @example
 * matchesPersonFilter(person, 'family', 'smith');
 * // => true
 * 
 * @example
 * matchesPersonFilter(person, 'place', 'kerala');
 * // => true
 */
function matchesPersonFilter(p, filterType, normValue) {
    if (!p || p.isGhost || p._isUnknown) return false;
    switch (filterType) {
        case 'family':
            return Boolean(p.family && p.family.toLowerCase().trim() === normValue);
        case 'job':
            return Boolean(p.job && p.job.toLowerCase().includes(normValue));
        case 'place':
            return matchesPlaceFilter(p.place, normValue);
        case 'search':
            return matchesPersonSearch(p, normValue);
        default:
            return false;
    }
}

/**
 * Compares two person instances for ordering in filtered lists.
 *
 * For search queries, prefix matches on name or nickname take priority over substring matches.
 * Secondary ordering is chronological by year of birth, followed alphabetically by name.
 *
 * @param {Person} a - First person
 * @param {Person} b - Second person
 * @param {string} filterType - Active filter type
 * @param {string} normValue - Lowercase query string
 * @returns {number} Negative if a < b, positive if a > b, zero if equal
 * 
 * @example
 * [personA, personB].sort((a, b) => compareFilteredPersons(a, b, 'search', 'john'));
 * 
 * @example
 * [personA, personB].sort((a, b) => compareFilteredPersons(a, b, 'place', 'kerala'));
 */
function compareFilteredPersons(a, b, filterType, normValue) {
    if (filterType === 'search') {
        return _compareSearchCandidates(a, b, normValue);
    }
    const yobA = a.yob || a._inferredYob || 9999;
    const yobB = b.yob || b._inferredYob || 9999;
    if (yobA !== yobB) return yobA - yobB;
    return (a.name || '').localeCompare(b.name || '');
}

/**
 * Badge style presets and labels for filter categories.
 * @type {Readonly<Record<string, { typeLabel: string, directoryLabel: string, color: string, ringColor: string }>>}
 */
const FILTER_BADGE_CONFIG = Object.freeze({
    family: {
        typeLabel: 'Family Name',
        directoryLabel: 'All Family Names',
        color: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100',
        ringColor: 'ring-2 ring-purple-500 !border-purple-600'
    },
    job: {
        typeLabel: 'Career',
        directoryLabel: 'All Careers',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
        ringColor: 'ring-2 ring-emerald-500 !border-emerald-600'
    },
    search: {
        typeLabel: 'Search',
        directoryLabel: 'Search',
        color: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100',
        ringColor: 'ring-2 ring-blue-500 !border-blue-600'
    },
    place: {
        typeLabel: 'Location',
        directoryLabel: 'All Locations',
        color: 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100',
        ringColor: 'ring-2 ring-rose-500 !border-rose-600'
    }
});

/**
 * Renders the corresponding SVG icon for a filter category badge.
 *
 * @param {string} filterType - 'family' | 'job' | 'search' | 'place'
 * @returns {React.ReactNode} Rendered icon element
 *
 * @example
 * _renderFilterBadgeIcon('job');
 * // => <svg ...><rect .../></svg>
 * 
 * @example
 * _renderFilterBadgeIcon('place');
 * // => <Icons.MapPin />
 */
function _renderFilterBadgeIcon(filterType) {
    if (filterType === 'family') {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        );
    }
    if (filterType === 'job') {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        );
    }
    if (filterType === 'search') {
        return <Icons.Search />;
    }
    return <Icons.MapPin />;
}

/**
 * Returns badge metadata (type label, icon, and tailwind color styles) for a filter type.
 *
 * @param {string} filterType - 'family' | 'job' | 'search' | 'place'
 * @returns {{ typeLabel: string, directoryLabel: string, icon: React.ReactNode, color: string, ringColor: string }} Badge configuration
 * 
 * @example
 * getFilterBadgeInfo('family');
 * // => { typeLabel: 'Family Name', directoryLabel: 'All Family Names', ... }
 * 
 * @example
 * getFilterBadgeInfo('job');
 * // => { typeLabel: 'Career', directoryLabel: 'All Careers', ... }
 */
function getFilterBadgeInfo(filterType) {
    const config = FILTER_BADGE_CONFIG[filterType] || FILTER_BADGE_CONFIG.place;
    return {
        typeLabel: config.typeLabel,
        directoryLabel: config.directoryLabel,
        icon: _renderFilterBadgeIcon(filterType),
        color: config.color,
        ringColor: config.ringColor
    };
}

FamilyTreeBuilder.matchesPersonFilter = matchesPersonFilter;
FamilyTreeBuilder.FILTER_BADGE_CONFIG = FILTER_BADGE_CONFIG;
FamilyTreeBuilder.getFilterBadgeInfo = getFilterBadgeInfo;
FamilyTreeBuilder.computeFilterHighlightedIds = function(tree, activeFilter) {
    if (!tree || !activeFilter || activeFilter.filterType === 'directory') return null;
    const normVal = (activeFilter.value || '').toLowerCase().trim();
    if (!normVal && activeFilter.filterType !== 'search') return null;
    const ids = new Set();
    (tree.all || []).forEach(p => {
        if (matchesPersonFilter(p, activeFilter.filterType, normVal)) {
            ids.add(p.id);
        }
    });
    return ids;
};