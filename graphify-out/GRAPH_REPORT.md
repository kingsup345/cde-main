# Graph Report - crypto-decision-engine-main  (2026-09-10)

## Corpus Check
- 232 files · ~260,579 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2382 nodes · 6097 edges · 111 communities (96 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eaf27649`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- backtestSweep.ts
- SimulationBot.tsx
- backtestRunner.ts
- tradingApiClient.ts
- tradingWorker.ts
- Portfolio.tsx
- Candle
- marketDataService.test.ts
- execution.ts
- Crypto Decision Engine SPA Entry (index.html)
- hooks/use-toast.ts
- 4. בוט Bybit (TrendBreakout · פריצת מגמה) — סימולציה בלבד
- decisionFunnel.ts
- פירוט לפי סעיף
- AdvancedAnalysis.tsx
- react
- services/pathStudy.ts
- compilerOptions
- Gauge.tsx
- simExecution.ts
- manifest.json
- SimPosition
- market-data.ts
- compilerOptions
- compilerOptions
- DecisionContext
- toBaseAsset
- 1. מנוע TrendBreakout המלא (`trendBreakout.ts` + `trendBreakoutExecution.ts`)
- prev4hRangeExecution.ts
- threeBotIntegration.test.ts
- components.json
- backtestCompare.ts
- correlation.test.ts
- simDefaults.ts
- compilerOptions
- cryptoPriceAggregator.ts
- dependencies
- bybitApi.ts
- דוח אימות — האם ההחלטות בוצעו? (בדיקה אמפירית בקוד)
- analyzeDecisions.ts
- scan
- אלגוריתם ההחלטה של הבוטים (סימולציה ומסחר אמיתי)
- devDependencies
- main.tsx
- compilerOptions
- scripts
- server/package.json
- דוח אימות ממצאים + תוכנית תיקונים
- DEPLOYMENT — הגדרת Render + Netlify + Firebase
- intradayBridge.ts
- BacktestResults.tsx
- errorHandlerSanitizer.test.ts
- SimulationEngineColumn.tsx
- cn
- Fix plan — unblock the four sim bots and cut the redundant gating
- proAlgEngine.ts
- src/index.ts
- symbolUniverse.ts
- json
- engine/package.json
- ProSimulationBotContext.tsx
- useApiPollingCascade.test.ts
- shutdown
- proConfidenceProfile.ts
- דוח אנליסט — סתירות ובאגים בדף "השוואת ביצועי הבוטים"
- tradeEngine.ts
- ErrorBoundary
- smoke-test.mjs
- skills-generation-protocol.md
- package.json
- TradingApiClient
- sonner.tsx
- backtestLegacyPro.ts
- sanitizeSimConfig
- BotRequest
- מפרט מלא — בוט הסימולציה הרביעי: `TrendBreakout` ("Bybit")
- capacitor.config.ts
- allowScripts
- SCOPING — Limit/Market toggle + dynamic Risk Profile, for all 4 sim bots
- CI Workflow (GitHub Actions)
- render.yaml Render Web Service Config
- trendBreakout.test.ts
- trendBreakoutExecution.ts
- button.tsx
- types.ts
- PathSimulationBotContext.tsx
- analysis.ts
- vitest
- emaSeedingImpact.ts
- WorkerAuthContext.tsx
- Analyst report — why Pro & "new" over-abstain, and how to make all four sim bots trade more consistently
- useSimulationBot.ts
- RealTradingBot.tsx
- LiveBoard.tsx
- App.tsx
- positionSizing.test.ts
- toBybitSymbol
- PipelineStage
- intradayLossFixes.test.ts
- duplicatePositionStacking.test.ts
- LivePositionChart.tsx
- pathSimExecution.test.ts
- eslint.config.js
- service-worker.js
- tailwindcss
- vite.config.ts

## God Nodes (most connected - your core abstractions)
1. `Candle` - 72 edges
2. `cn()` - 65 edges
3. `react` - 61 edges
4. `SimPosition` - 47 edges
5. `SignalEvaluation` - 42 edges
6. `PendingOrder` - 42 edges
7. `lucide-react` - 39 edges
8. `vitest` - 38 edges
9. `SimBotConfig` - 31 edges
10. `SimTrade` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Placeholder Image Icon SVG` --conceptually_related_to--> `Crypto Decision Engine SPA Entry (index.html)`  [INFERRED]
  public/placeholder.svg → index.html
- `toInternalSymbol()` --calls--> `toBaseAsset()`  [EXTRACTED]
  src/services/bybitApi.ts → packages/engine/src/services/assetUniverse.ts
- `tick()` --indirect_call--> `computeAtr5()`  [INFERRED]
  server/simEngineFactory.ts → packages/engine/src/services/intradayBridge.ts
- `ScanResult` --references--> `IntradayDecision`  [EXTRACTED]
  server/tradingWorker.ts → packages/engine/src/services/intradayEngine.ts
- `BotInput` --references--> `SimPosition`  [EXTRACTED]
  src/pages/BacktestResults.tsx → packages/engine/src/services/simExecution.ts

## Import Cycles
- None detected.

## Communities (111 total, 10 thin omitted)

### Community 0 - "backtestSweep.ts"
Cohesion: 0.06
Nodes (37): buildGrid(), Combo, ComboResult, CONC, DAYS, ENTRY_MIN, fetchHistory(), fetchKlinesPaged() (+29 more)

### Community 1 - "SimulationBot.tsx"
Cohesion: 0.12
Nodes (34): CryptoRecommendation, FearGreedIndex, react-router-dom, CryptoCard(), CryptoCardProps, safeNumber(), CryptoDetailModalProps, FEAR_GREED_ZONES (+26 more)

### Community 2 - "backtestRunner.ts"
Cohesion: 0.07
Nodes (47): TradeSide, arg(), argNum(), Candle, cmdRun(), cmdSnapshot(), cmdSnapshotMtf(), FIXED_SL (+39 more)

### Community 3 - "tradingApiClient.ts"
Cohesion: 0.09
Nodes (36): SimBotConfig, BYBIT_SIM_BOT_LAST_KNOWN_RUNNING_KEY, BybitSimulationBotContext, BybitSimulationBotProvider(), DEFAULT_BYBIT_CONFIG, EMPTY_SNAPSHOT, DEFAULT_CONFIG, SimulationBotContext (+28 more)

### Community 4 - "tradingWorker.ts"
Cohesion: 0.03
Nodes (58): BybitSimSnapshot, PathSimSnapshot, ProSimSnapshot, allowedOrigins, archiveStore, BoardSource, botSymbolsRaw, bybitMinConfidenceEnv (+50 more)

### Community 5 - "Portfolio.tsx"
Cohesion: 0.12
Nodes (16): PortfolioAnalysis, recharts, CryptoChart(), FloatingActionMenu(), FloatingActionMenuProps, Particle, ParticleBackground(), PersonalizedDashboard() (+8 more)

### Community 6 - "Candle"
Cohesion: 0.09
Nodes (29): CandleCache, BacktestHistory, binanceListsSymbol(), BybitKlineResponse, BybitTickerRow, CandleSource, CandleValidationResult, clearFundingCache() (+21 more)

### Community 7 - "marketDataService.test.ts"
Cohesion: 0.13
Nodes (11): clearMarketDataCache(), dropFormingCandle(), fetchBacktestHistory(), fetchBybitKlines(), fetchTimeframe(), isAlignedToTimeframe(), TIMEFRAME_SPECS, validateCandles() (+3 more)

### Community 8 - "execution.ts"
Cohesion: 0.09
Nodes (44): AdaptiveRiskInput, adaptiveRiskPercentFromHistory(), ClosedTradeRecord, computeAdaptiveRiskPercent(), computeDrawdownFactor(), computeSizingMultiplier(), computeStreakFactor(), computeSymbolStreakCooldownUntil() (+36 more)

### Community 9 - "Crypto Decision Engine SPA Entry (index.html)"
Cohesion: 0.67
Nodes (3): Crypto Decision Engine SPA Entry (index.html), Placeholder Image Icon SVG, robots.txt Crawler Allow Policy

### Community 10 - "hooks/use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 11 - "4. בוט Bybit (TrendBreakout · פריצת מגמה) — סימולציה בלבד"
Cohesion: 0.04
Nodes (47): 1. בוט חדש (Intraday · Multi-Timeframe), 2. בוט פרו (Pro · alg.md מדויק), 3. נתיב 4H (Prev-4H Range · טווח נר קודם), 4. בוט Bybit (TrendBreakout · פריצת מגמה) — סימולציה בלבד, Funding (נוסף עם בוט 4, חל על כל ארבעתם), Scale-in (§11) — מודל lots, SHORT, אין עוקף high-confidence (+39 more)

### Community 12 - "decisionFunnel.ts"
Cohesion: 0.10
Nodes (28): Agg, BINANCE_INTERVAL, bump(), BybitApiResponse, BybitKlineResult, BybitTicker, BybitTickerResult, CONC (+20 more)

### Community 13 - "פירוט לפי סעיף"
Cohesion: 0.06
Nodes (34): §10 — signalPrice מול actualFillPrice, §11 — Position Target מול Actual Fill, §12 — Parameter Source of Truth, §13 — Closed Candle Consistency, §14 — Prev4hRange Candle Closure, §15 — Backtest מול Sim/Live Economics, §16 — Pro Bot HOLD מול ALREADY_HELD, §17 — Pro Bot Confidence Reproducibility (+26 more)

### Community 14 - "AdvancedAnalysis.tsx"
Cohesion: 0.12
Nodes (16): candles, r, MatrixBackground(), MatrixBackgroundProps, AdvancedAnalysis(), computeWilliamsR(), PatternItem, Predictions (+8 more)

### Community 15 - "react"
Cohesion: 0.19
Nodes (10): react, AIChatbot(), AIChatbotProps, Message, AlertsPanel(), AlertsPanelProps, ScrollArea, ScrollBar (+2 more)

### Community 16 - "services/pathStudy.ts"
Cohesion: 0.06
Nodes (57): buildFearGreedSeries(), fearGreedAt(), FearGreedPoint, FearGreedSeries, fetchFearGreedHistory(), parseFearGreedPayload(), utcDayStart(), bucketKey() (+49 more)

### Community 17 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 18 - "Gauge.tsx"
Cohesion: 0.57
Nodes (6): angleFor(), arcPath(), clamp(), Gauge(), GaugeProps, polarToXY()

### Community 19 - "simExecution.ts"
Cohesion: 0.09
Nodes (38): isInStreakCooldown(), streakCooldownFromHistory(), clampNum(), CorrelatedHolding, DEFAULT_CORRELATION_LOOKBACK, DEFAULT_CORRELATION_THRESHOLD, DEFAULT_MAX_CORRELATED, evaluateCorrelationGate() (+30 more)

### Community 20 - "manifest.json"
Cohesion: 0.11
Nodes (17): background_color, categories, description, dir, display, features, icons, lang (+9 more)

### Community 21 - "SimPosition"
Cohesion: 0.15
Nodes (33): FundingSnapshot, resolveTradeSide(), SignalEvaluation, PathOrderGenContext, Prev4hRangeOrderGenContext, ProSignalResult, ProOrderGenContext, SIM_MIN_CONFIDENCE (+25 more)

### Community 22 - "market-data.ts"
Cohesion: 0.23
Nodes (16): ANALYTICS_UNIVERSE, ASSET_REGISTRY, AssetRegistryEntry, EXCLUDED_BASES, EXTENDED_INTRADAY_UNIVERSE, getAssetTier(), INTRADAY_UNIVERSE, isExcludedAsset() (+8 more)

### Community 23 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit (+8 more)

### Community 24 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+8 more)

### Community 25 - "DecisionContext"
Cohesion: 0.14
Nodes (12): IntradayAdapter, mapDirection(), mapOutcome(), mapRiskPlan(), mapTradeType(), PathAdapter, DecisionEngine, DecisionContext (+4 more)

### Community 26 - "toBaseAsset"
Cohesion: 0.19
Nodes (22): toBaseAsset(), createBybitSimEngine(), createPathSimEngine(), createProSimEngine(), createSimEngine(), createGenericSimEngine(), buildH1CandlesForSymbol(), buildM5CandlesForSymbol() (+14 more)

### Community 27 - "1. מנוע TrendBreakout המלא (`trendBreakout.ts` + `trendBreakoutExecution.ts`)"
Cohesion: 0.07
Nodes (29): 1.1 פרמטרים (spec §23), 1.2 זרימה (state machine — spec §6), 1.3 אינדיקטורים (סעיף 2 — closed candles only), 1.4 חישוב Score (סעיף 7), 1.5 Entry / SL / TP (סעיפים 9/10), 1.6 Stop management (סעיף 12), 1.7 Exits (סעיף 13), 1. מנוע TrendBreakout המלא (`trendBreakout.ts` + `trendBreakoutExecution.ts`) (+21 more)

### Community 28 - "prev4hRangeExecution.ts"
Cohesion: 0.06
Nodes (48): cappedTakeProfitLevels(), capStopLoss(), ExitLevel, MAX_LOSS_PERCENT, maxLossStopLevel(), stopWasCapped(), takeProfitLevels(), TP1_EXIT_FRACTION (+40 more)

### Community 29 - "threeBotIntegration.test.ts"
Cohesion: 0.19
Nodes (15): PathRegime, PATH_SIM_BOT_LAST_KNOWN_RUNNING_KEY, SIM_BOT_STORAGE_KEY, AggregatableContext, AggregatedBot, CombinedRisk, combineRisk(), groupAction() (+7 more)

### Community 30 - "components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 31 - "backtestCompare.ts"
Cohesion: 0.16
Nodes (16): BINANCE_INTERVAL, BybitKlineResponse, CONC, fetchBinance(), fetchBybit(), fetchJson(), fetchKlines(), FM_LIMIT (+8 more)

### Community 32 - "correlation.test.ts"
Cohesion: 0.43
Nodes (4): alignCloses(), correlationBetween(), pearsonCorrelation(), toLogReturns()

### Community 33 - "simDefaults.ts"
Cohesion: 0.17
Nodes (16): MAX_TOTAL_EXPOSURE_PERCENT, POSITION_TARGET_PCT, ConfidenceScale, riskLevelToMaxPositions(), SIM_BASE_DEFAULTS, SIM_BOT_IDS, SIM_BOT_SPECS, SIM_BOTS (+8 more)

### Community 34 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit (+8 more)

### Community 35 - "cryptoPriceAggregator.ts"
Cohesion: 0.23
Nodes (12): CRYPTO_IDS, BinanceKlineRaw, BinanceTicker, coinGeckoPriceCache, fetchBinanceAllTickers(), fetchBybitAllTickers(), fetchCoinGeckoPrices(), getAggregatedCandles() (+4 more)

### Community 36 - "dependencies"
Cohesion: 0.03
Nodes (59): dependencies, @capacitor/android, @capacitor/cli, @capacitor/core, @capacitor/ios, class-variance-authority, clsx, cmdk (+51 more)

### Community 37 - "bybitApi.ts"
Cohesion: 0.23
Nodes (8): TARGET_SYMBOLS, BybitKlineData, BybitTicker, toInternalSymbol(), fetchFromWorker(), fetchLiveUniverse(), getActiveSymbols(), resolveWorkerBaseUrl()

### Community 38 - "דוח אימות — האם ההחלטות בוצעו? (בדיקה אמפירית בקוד)"
Cohesion: 0.09
Nodes (21): ⚠️ אזהרה על הטסטים החדשים (`positionSizing.test.ts`), ✅ בוצע ואומת, דוח אימות — האם ההחלטות בוצעו? (בדיקה אמפירית בקוד), 🟡 חלקי, טבלת ההחלטות שלך — מצב בפועל, ❌ לא בוצע, ממצאים חדשים, ❌ נשאר פתוח (deliverables גדולים, 0% קוד) (+13 more)

### Community 39 - "analyzeDecisions.ts"
Cohesion: 0.21
Nodes (13): BUCKET_BOUNDS, BUCKET_LABELS, BucketStats, computeBuckets(), formatPercent(), getBucketIndex(), getTopReason(), main() (+5 more)

### Community 40 - "scan"
Cohesion: 0.22
Nodes (16): buildPortfolioRiskStats(), baseCoin(), bybitExec(), checkClosedFuturesPositions(), checkClosedSpotPositions(), confirmSpotEntries(), executeOrder(), fetchWithTimeout() (+8 more)

### Community 41 - "אלגוריתם ההחלטה של הבוטים (סימולציה ומסחר אמיתי)"
Cohesion: 0.14
Nodes (13): 10. תרשים זרימה מקוצר, 1. מקורות הנתונים, 2. מנוע ההמלצות — חישוב הביטחון, 3. סף הביצוע של הבוט, 4. שכבת ההערכה (Single Source of Truth), 5. יציאות ניהול סיכון (עצמאיות מההמלצות), 6. מנוע הביצוע — עמלות, החלקה והשהיה, 7. מחזור החיים והרציפות (+5 more)

### Community 42 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, lovable-tagger (+12 more)

### Community 43 - "main.tsx"
Cohesion: 0.38
Nodes (4): App(), rootElement, isProduction, initializeProductionOptimizations()

### Community 44 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, noImplicitAny, noUnusedLocals, noUnusedParameters, paths, skipLibCheck, strictNullChecks (+3 more)

### Community 45 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, build:dev, build:worker, dev, lint, preview, start (+5 more)

### Community 46 - "server/package.json"
Cohesion: 0.10
Nodes (20): dependencies, dotenv, devDependencies, esbuild, tsx, typescript, engines, node (+12 more)

### Community 47 - "דוח אימות ממצאים + תוכנית תיקונים"
Cohesion: 0.10
Nodes (19): 1. ⚠️ `calculateEMA` — באג seeding בליבה (לא רק Bybit), 2. ✅ Path — שער ה-RR הופך את רכיב ה-breakout לחצי-מת, 3. ✅ Pro — breakeven ב-61.1%, 4. ✅ Pro — רצועות מומנטום דיסקרטיות, 5. ✅ `fillDueOrders` — מילוי מוקטן (מעלה בדירוג ל-P0), 6. ליקויים משניים — כולם מאומתים, דוח אימות ממצאים + תוכנית תיקונים, הערה על `minH1: 200` (+11 more)

### Community 48 - "DEPLOYMENT — הגדרת Render + Netlify + Firebase"
Cohesion: 0.11
Nodes (17): 1.1 יצירת הפרויקט, 1.2 יצירת Service Account, 1.3 המרה לשורה אחת (חובה למשתנה סביבה), 1.4 שני המשתנים ל-Render, 1. Firebase — Firestore + Service Account, 2.1 הגדרות השירות, 2.2 משתני סביבה (Dashboard → Environment), 2.3 בדיקה אחרי deploy (+9 more)

### Community 49 - "intradayBridge.ts"
Cohesion: 0.09
Nodes (51): intradayResultCache, BacktestMetrics, BacktestResult, BacktestTrade, computeMetrics(), OpenPosition, PendingOrder, runBacktest() (+43 more)

### Community 50 - "BacktestResults.tsx"
Cohesion: 0.22
Nodes (16): useBybitSimulationBotContext(), usePathSimulationBotContext(), useProSimulationBotContext(), useSimulationBotContext(), useWorkerAuth(), BacktestResults(), BotInput, BotKey (+8 more)

### Community 51 - "errorHandlerSanitizer.test.ts"
Cohesion: 0.06
Nodes (36): createDefaultPortfolio(), isPortfolioShaped(), normalizeItem(), usePortfolio(), Binance24hTicker, BinanceKline, binancePublicApi, AlternativeMeResponse (+28 more)

### Community 52 - "SimulationEngineColumn.tsx"
Cohesion: 0.12
Nodes (25): lucide-react, CryptoChartProps, CryptoDetailModal(), safeNumber(), HistoryPoint, Metric, PortfolioPulseCard(), Props (+17 more)

### Community 53 - "cn"
Cohesion: 0.12
Nodes (25): @radix-ui/react-dropdown-menu, Alert, AlertDescription, AlertTitle, alertVariants, CardDescription, CardFooter, DropdownMenuCheckboxItem (+17 more)

### Community 54 - "Fix plan — unblock the four sim bots and cut the redundant gating"
Cohesion: 0.04
Nodes (44): Algorithm as it runs today, Algorithm as it runs today, Algorithm today, Algorithm today, BOT 1 — Pro (`proAlgEngine.ts`, `proSimExecution.ts`), BOT 2 — new / intraday (`intradayEngine.ts`, `intradayRegime.ts`, `intradaySetup.ts`, `intradayEntry.ts`, `intradayRisk.ts`, `intradayAdapter.ts`), BOT 3 — Path / prev4hRange (`prev4hRange.ts`, `prev4hRangeExecution.ts`), BOT 4 — Bybit / TrendBreakout (`trendBreakout.ts`, `trendBreakoutExecution.ts`) (+36 more)

### Community 55 - "proAlgEngine.ts"
Cohesion: 0.05
Nodes (69): calculateOptimalEntryPrice(), computeProSignal(), PRO_ALLOCATION_DEFAULT_PERCENT, PRO_ALLOCATION_HIGH_CONFIDENCE_THRESHOLD, PRO_ALLOCATION_HIGH_PERCENT, PRO_CONFIDENCE_BY_RISK, PRO_COVERAGE_FULL_WEIGHT, PRO_DEFAULT_ENTRY_CONFIDENCE (+61 more)

### Community 56 - "src/index.ts"
Cohesion: 0.09
Nodes (34): CORRELATION_LOOKBACK_FLOOR, CorrelationGateInput, CorrelationMatch, MIN_CORRELATION_SAMPLES, PositionDirection, EvaluateUniverseOptions, ExitPortfolioInput, fetchSymbolSnapshot() (+26 more)

### Community 57 - "symbolUniverse.ts"
Cohesion: 0.27
Nodes (9): baseAndKind(), BybitTickerRow, computeLiquidUniverse(), EXCLUDE_BASES, fetchTickers(), LiquidUniverseResult, MIN_SPOT_VOLUME_FOR_INCLUSION, MULTIPLIER_PREFIXES (+1 more)

### Community 58 - "json"
Cohesion: 0.22
Nodes (7): BotResponse, currentFearGreed(), fetchFearGreed(), fetchFearGreedFull(), json(), setCors(), startSimTicker()

### Community 59 - "engine/package.json"
Cohesion: 0.22
Nodes (8): exports, ./analysis, ./execution, ./market-data, name, private, type, version

### Community 60 - "ProSimulationBotContext.tsx"
Cohesion: 0.31
Nodes (9): DEFAULT_PRO_CONFIG, ProSimulationBotContext, ProSimulationBotProvider(), getProSimState(), ProSimBotStateResponse, resetProSim(), setProSimConfig(), startProSim() (+1 more)

### Community 61 - "useApiPollingCascade.test.ts"
Cohesion: 0.25
Nodes (4): createHarness(), depsEqual(), Harness, PollFn

### Community 62 - "shutdown"
Cohesion: 0.33
Nodes (6): persistBybitSim(), persistPathSim(), persistProSim(), persistSim(), serializeState(), shutdown()

### Community 63 - "proConfidenceProfile.ts"
Cohesion: 0.52
Nodes (6): arg(), klines(), main(), q(), share(), topSymbols()

### Community 64 - "דוח אנליסט — סתירות ובאגים בדף "השוואת ביצועי הבוטים""
Cohesion: 0.14
Nodes (13): 🔴 F-1 — בסיס ההון מקודד קשיח ל-‎$10,000‎ (שורש ה-−90%), 🔴 F-2 — שורת ה-"סה"כ" סובלת מאותו באג, מוכפל פי 4, 🟠 F-3 — שני מדדי P&L שונים מוצגים זה לצד זה בלי הבחנה, 🟠 F-4 — `hasServerData` לא נבדק: בוט מנותק נספר כ-"שטוח, 0%", 🟡 F-5 — הדף מחשב מחדש Win Rate / מספר עסקאות במקום להשתמש בנתוני השרת, 🟡 F-6 — אין בדיקת-שפיות (reconciliation) על המסך, דוח אנליסט — סתירות ובאגים בדף "השוואת ביצועי הבוטים", הערכת אנליסט (+5 more)

### Community 65 - "tradeEngine.ts"
Cohesion: 0.15
Nodes (45): confirmEntry5M(), emptyEntry(), atrRegime(), bollinger(), BollingerResult, candleQuality, clamp(), compression() (+37 more)

### Community 68 - "skills-generation-protocol.md"
Cohesion: 0.08
Nodes (25): 10. PROJECT-SPECIFIC SKILLS, 11. SKILL SELECTION MATRIX, 12. PROJECT RULE GENERATION, 13. GLOBAL VS PROJECT RULES, 14. RULE PRIORITY, 15. SKILL UPDATE RULE, 16. SKILL VERSIONING, 17. SKILL VALIDATION (+17 more)

### Community 69 - "package.json"
Cohesion: 0.03
Nodes (60): dotenv, esbuild, tsx, typescript, name, private, type, version (+52 more)

### Community 71 - "sonner.tsx"
Cohesion: 0.40
Nodes (4): next-themes, sonner, Toaster(), ToasterProps

### Community 73 - "backtestLegacyPro.ts"
Cohesion: 0.40
Nodes (3): CONC, DAYS, SYMS

### Community 74 - "sanitizeSimConfig"
Cohesion: 0.33
Nodes (6): applySimConfigPatch(), hydrateBybitSim(), hydratePathSim(), hydrateProSim(), hydrateSim(), sanitizeSimConfig()

### Community 76 - "מפרט מלא — בוט הסימולציה הרביעי: `TrendBreakout` ("Bybit")"
Cohesion: 0.07
Nodes (26): 10. Take Profit, 11. SCALE — Scale-in מדורג (לא פותחים הכול בבת אחת), 12. Stop Management, 13. Exit Conditions, 14. Risk Management, 15. Exposure Limits, 16. Drawdown Protection, 17. Simulation Execution (+18 more)

### Community 78 - "allowScripts"
Cohesion: 0.40
Nodes (5): allowScripts, esbuild@0.21.5, esbuild@0.25.0, esbuild@0.28.2, @swc/core@1.16.1

### Community 79 - "SCOPING — Limit/Market toggle + dynamic Risk Profile, for all 4 sim bots"
Cohesion: 0.17
Nodes (11): 0. Worker URL — `cde-main.onrender.com` (תיקון קטן), 1. Limit / Market toggle — מצב נוכחי לכל בוט, 2. פרופיל סיכון (low / medium / high) — מצב נוכחי, 3. Intraday → מודל `equity × 10%` (מההודעה הקודמת), 4. סיכום קבצים + הכרעות פתוחות, SCOPING — Limit/Market toggle + dynamic Risk Profile, for all 4 sim bots, ✅ בוצע (2026-09-07), הכרעות שצריך ממך לפני ביצוע (+3 more)

### Community 84 - "trendBreakout.test.ts"
Cohesion: 0.14
Nodes (17): applyFundingAccrual(), MIN_SIM_ENTRY_USD, DEFAULT_TREND_BREAKOUT_PARAMS, TrendBreakoutPlan, C, longSignalInput(), ramp(), ctx() (+9 more)

### Community 85 - "trendBreakoutExecution.ts"
Cohesion: 0.14
Nodes (29): portfolioStreakCooldownReason(), isLongSide(), positionPnlPercent(), reachedStop(), reachedTarget(), CAPITAL_FLOOR_PCT, isBelowCapitalFloor(), PER_ASSET_EXPOSURE_CAP_PERCENT (+21 more)

### Community 86 - "button.tsx"
Cohesion: 0.16
Nodes (16): PortfolioItem, class-variance-authority, Props, State, AddCryptoForm(), AddCryptoFormProps, CurrentPortfolioItems(), CurrentPortfolioItemsProps (+8 more)

### Community 87 - "types.ts"
Cohesion: 0.27
Nodes (12): CorrelationGateResult, PathEngineParams, DecisionEngineOptions, DecisionOutcome, EngineParams, MarketDataSnapshot, MultiTimeframeCandles, OpenPosition (+4 more)

### Community 88 - "PathSimulationBotContext.tsx"
Cohesion: 0.27
Nodes (9): DEFAULT_PATH_CONFIG, EMPTY_SNAPSHOT, PathSimulationBotContext, PathSimulationBotProvider(), getPathSimState(), resetPathSim(), setPathSimConfig(), startPathSim() (+1 more)

### Community 89 - "analysis.ts"
Cohesion: 0.09
Nodes (43): annualisedFundingPct(), evaluateFundingGate(), FUNDING_CROWDED_ANNUAL_PCT, FUNDING_EXTREME_ANNUAL_PCT, FUNDING_MAX_AGE_MS, FUNDING_MIN_SIZE_MULTIPLIER, FUNDING_PERIODS_PER_YEAR, FundingVerdict (+35 more)

### Community 90 - "vitest"
Cohesion: 0.10
Nodes (21): emptyDecision(), evaluateIntradayDecision(), finalize(), isFullParams(), withParams(), buildRiskPlan(), evaluateCostEdge(), FIXED_TP_PERCENT (+13 more)

### Community 91 - "emaSeedingImpact.ts"
Cohesion: 0.33
Nodes (10): Candle, clamp01(), emaShipped(), emaTextbook(), fetchKlines(), last(), main(), pct() (+2 more)

### Community 92 - "WorkerAuthContext.tsx"
Cohesion: 0.48
Nodes (5): WorkerAuthContext, WorkerAuthContextValue, WorkerAuthProvider(), resolveWorkerBaseUrlWithSource(), UrlSource

### Community 93 - "Analyst report — why Pro & "new" over-abstain, and how to make all four sim bots trade more consistently"
Cohesion: 0.09
Nodes (22): 0. TL;DR, 1.1 The signal is structurally a capitulation-dip buyer, 1.2 …and then `isDowntrend` blocks exactly that, 1.3 The confidence threshold is **not** the bottleneck, 1.4 Risk flaw — flat 4.2% stop against a 3% target, 1.5 Cruft introduced by the last parallel session (`db9e864`/`6c300cd`), 1. Pro — `proAlgEngine.ts` + `proSimExecution.ts`, 2.1 The regime bucket is a cliff (`intradayRegime.ts`) (+14 more)

### Community 94 - "useSimulationBot.ts"
Cohesion: 0.18
Nodes (20): buildFactorsFromDecisionResult(), computeAtr5(), MIN_PRO_CANDLES, proMinConfidence(), buildProEvaluation(), applySlotPreemptions(), selectFillableOrders(), CryptoData (+12 more)

### Community 95 - "RealTradingBot.tsx"
Cohesion: 0.19
Nodes (14): ExecutiveDashboard(), PortfolioRiskMeter(), TabsContent, TabsList, TabsTrigger, useProSimulationBotContextSafe(), useSimulationBotContextSafe(), useApiPolling() (+6 more)

### Community 96 - "LiveBoard.tsx"
Cohesion: 0.24
Nodes (13): ACCENT, accentOf(), BotCard(), clock(), LiveBoard(), pct(), price(), SIDE_LABEL (+5 more)

### Community 97 - "App.tsx"
Cohesion: 0.17
Nodes (12): @tanstack/react-query, queryClient, ThemeToggle(), DropdownMenuContent, DropdownMenuItem, Theme, ThemeContext, ThemeContextType (+4 more)

### Community 98 - "positionSizing.test.ts"
Cohesion: 0.15
Nodes (10): DEFAULT_POSITION_PERCENT, fillDueOrders(), MIN_ORDER_EXCEEDS_POSITION_TARGET, reanchorLevel(), riskLevelSizingMultiplier(), calculateTradingFee(), DEFAULT_SLIPPAGE_PERCENT, FEE_REFERENCE_PERCENT (+2 more)

### Community 99 - "toBybitSymbol"
Cohesion: 0.22
Nodes (13): toBybitSymbol(), evaluateUniverse(), cacheKey(), exportMarketDataCache(), fetchLiquiditySnapshots(), getLiquiditySnapshots(), getMultiTimeframeData(), getUniverseMarketData() (+5 more)

### Community 100 - "PipelineStage"
Cohesion: 0.24
Nodes (6): CircuitBreakerStage, ExposureStage, RunEngineStage, ValidateInputStage, PipelineStage, StageResult

### Community 101 - "intradayLossFixes.test.ts"
Cohesion: 0.24
Nodes (6): bullScenario(), candlesFromCloses(), confirmedShort, ExitPos, TF, trendPath()

### Community 102 - "duplicatePositionStacking.test.ts"
Cohesion: 0.25
Nodes (4): ProRiskLevel, ProGateContext, baseCtx, candlesBySymbol

### Community 103 - "LivePositionChart.tsx"
Cohesion: 0.39
Nodes (6): Candle, fmtClock(), fmtDay(), LivePositionChart(), LivePositionChartProps, formatFullPrice()

### Community 141 - "eslint.config.js"
Cohesion: 0.33
Nodes (5): @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, typescript-eslint

### Community 148 - "vite.config.ts"
Cohesion: 0.50
Nodes (3): lovable-tagger, vite, @vitejs/plugin-react-swc

## Ambiguous Edges - Review These
- `CI Workflow (GitHub Actions)` → `CI Workflow (GitHub Actions)`  [AMBIGUOUS]
  .github/workflows/ci.yml · relation: references

## Knowledge Gaps
- **817 isolated node(s):** `config`, `$schema`, `style`, `rsc`, `tsx` (+812 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 959 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `CI Workflow (GitHub Actions)` and `CI Workflow (GitHub Actions)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `backtestRunner.ts`, `tradingApiClient.ts`, `marketDataService.test.ts`, `execution.ts`, `services/pathStudy.ts`, `simExecution.ts`, `SimPosition`, `prev4hRangeExecution.ts`, `threeBotIntegration.test.ts`, `correlation.test.ts`, `simDefaults.ts`, `intradayBridge.ts`, `errorHandlerSanitizer.test.ts`, `proAlgEngine.ts`, `useApiPollingCascade.test.ts`, `package.json`, `trendBreakout.test.ts`, `analysis.ts`, `positionSizing.test.ts`, `intradayLossFixes.test.ts`, `duplicatePositionStacking.test.ts`, `pathSimExecution.test.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `SimulationBot.tsx`, `tradingApiClient.ts`, `Portfolio.tsx`, `hooks/use-toast.ts`, `AdvancedAnalysis.tsx`, `Gauge.tsx`, `BacktestResults.tsx`, `errorHandlerSanitizer.test.ts`, `SimulationEngineColumn.tsx`, `cn`, `ProSimulationBotContext.tsx`, `package.json`, `button.tsx`, `PathSimulationBotContext.tsx`, `WorkerAuthContext.tsx`, `useSimulationBot.ts`, `RealTradingBot.tsx`, `LiveBoard.tsx`, `App.tsx`, `LivePositionChart.tsx`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `config`, `$schema`, `style` to the rest of the system?**
  _817 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `backtestSweep.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05786090005844535 - nodes in this community are weakly interconnected._
- **Should `SimulationBot.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12244897959183673 - nodes in this community are weakly interconnected._