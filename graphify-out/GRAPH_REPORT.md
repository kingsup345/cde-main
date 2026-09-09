# Graph Report - crypto-decision-engine-main  (2026-09-09)

## Corpus Check
- 225 files · ~242,200 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2244 nodes · 5867 edges · 107 communities (92 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `64522102`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- backtestSweep.ts
- lucide-react
- backtestRunner.ts
- tradingApiClient.ts
- tradingWorker.ts
- Portfolio.tsx
- marketDataService.ts
- marketDataService.test.ts
- execution.ts
- Crypto Decision Engine SPA Entry (index.html)
- hooks/use-toast.ts
- 4. בוט Bybit (TrendBreakout · פריצת מגמה) — סימולציה בלבד
- decisionFunnel.ts
- פירוט לפי סעיף
- App.tsx
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
- correlation.ts
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
- analysis.ts
- BacktestResults.tsx
- errorHandlerSanitizer.test.ts
- PortfolioPulseCard.tsx
- cn
- intradaySetup.ts
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
- intradayIndicators.ts
- ErrorBoundary
- smoke-test.mjs
- intradayEngine.ts
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
- Candle
- trendBreakoutExecution.ts
- PortfolioBuilder.tsx
- intradayAdapter.ts
- PathSimulationBotContext.tsx
- pathEngine.ts
- vitest
- emaSeedingImpact.ts
- WorkerAuthContext.tsx
- scripts/pathStudy.ts
- useSimulationBot.ts
- pathValidation.test.ts
- LiveBoard.tsx
- evaluatePathDecision
- fillDueOrders
- fundingOrthogonality.ts
- createKVStore
- eslint.config.js
- service-worker.js
- tailwindcss
- vite.config.ts

## God Nodes (most connected - your core abstractions)
1. `Candle` - 70 edges
2. `cn()` - 65 edges
3. `react` - 61 edges
4. `SimPosition` - 45 edges
5. `SignalEvaluation` - 41 edges
6. `PendingOrder` - 41 edges
7. `lucide-react` - 39 edges
8. `vitest` - 34 edges
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

## Communities (107 total, 10 thin omitted)

### Community 0 - "backtestSweep.ts"
Cohesion: 0.06
Nodes (35): buildGrid(), Combo, ComboResult, CONC, DAYS, ENTRY_MIN, fetchHistory(), fetchKlinesPaged() (+27 more)

### Community 1 - "lucide-react"
Cohesion: 0.16
Nodes (27): CryptoRecommendation, PortfolioAnalysis, lucide-react, AIChatbotProps, Message, CryptoCard(), CryptoCardProps, safeNumber() (+19 more)

### Community 2 - "backtestRunner.ts"
Cohesion: 0.07
Nodes (47): calculateTradingFee(), TradeSide, arg(), argNum(), Candle, cmdRun(), cmdSnapshot(), cmdSnapshotMtf() (+39 more)

### Community 3 - "tradingApiClient.ts"
Cohesion: 0.09
Nodes (36): SimBotConfig, BybitSimulationBotContext, BybitSimulationBotProvider(), DEFAULT_BYBIT_CONFIG, EMPTY_SNAPSHOT, DEFAULT_CONFIG, SimulationBotContext, SimulationBotProvider() (+28 more)

### Community 4 - "tradingWorker.ts"
Cohesion: 0.03
Nodes (58): BybitSimSnapshot, PathSimSnapshot, ProSimSnapshot, allowedOrigins, archiveStore, BoardSource, botSymbolsRaw, bybitMinConfidenceEnv (+50 more)

### Community 5 - "Portfolio.tsx"
Cohesion: 0.09
Nodes (29): AIChatbot(), FloatingActionMenu(), FloatingActionMenuProps, Navigation(), Particle, ParticleBackground(), PersonalizedDashboard(), EmptyPortfolio() (+21 more)

### Community 6 - "marketDataService.ts"
Cohesion: 0.09
Nodes (36): toBybitSymbol(), binanceListsSymbol(), BybitKlineResponse, BybitTickerRow, cacheKey(), CandleSource, CandleValidationResult, clearFundingCache() (+28 more)

### Community 7 - "marketDataService.test.ts"
Cohesion: 0.13
Nodes (10): clearMarketDataCache(), dropFormingCandle(), fetchBacktestHistory(), fetchTimeframe(), isAlignedToTimeframe(), TIMEFRAME_SPECS, validateCandles(), REGISTRY (+2 more)

### Community 8 - "execution.ts"
Cohesion: 0.09
Nodes (40): AdaptiveRiskInput, adaptiveRiskPercentFromHistory(), computeAdaptiveRiskPercent(), computeDrawdownFactor(), computeSizingMultiplier(), computeStreakFactor(), computeSymbolStreakCooldownUntil(), computeWinRateFactor() (+32 more)

### Community 9 - "Crypto Decision Engine SPA Entry (index.html)"
Cohesion: 0.67
Nodes (3): Crypto Decision Engine SPA Entry (index.html), Placeholder Image Icon SVG, robots.txt Crawler Allow Policy

### Community 10 - "hooks/use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 11 - "4. בוט Bybit (TrendBreakout · פריצת מגמה) — סימולציה בלבד"
Cohesion: 0.04
Nodes (47): 1. בוט חדש (Intraday · Multi-Timeframe), 2. בוט פרו (Pro · alg.md מדויק), 3. נתיב 4H (Prev-4H Range · טווח נר קודם), 4. בוט Bybit (TrendBreakout · פריצת מגמה) — סימולציה בלבד, Funding (נוסף עם בוט 4, חל על כל ארבעתם), Scale-in (§11) — מודל lots, SHORT, אישור כניסה (M5, §5) (+39 more)

### Community 12 - "decisionFunnel.ts"
Cohesion: 0.10
Nodes (28): Agg, BINANCE_INTERVAL, bump(), BybitApiResponse, BybitKlineResult, BybitTicker, BybitTickerResult, CONC (+20 more)

### Community 13 - "פירוט לפי סעיף"
Cohesion: 0.06
Nodes (34): §10 — signalPrice מול actualFillPrice, §11 — Position Target מול Actual Fill, §12 — Parameter Source of Truth, §13 — Closed Candle Consistency, §14 — Prev4hRange Candle Closure, §15 — Backtest מול Sim/Live Economics, §16 — Pro Bot HOLD מול ALREADY_HELD, §17 — Pro Bot Confidence Reproducibility (+26 more)

### Community 14 - "App.tsx"
Cohesion: 0.10
Nodes (27): react-router-dom, @tanstack/react-query, queryClient, FearGreedIndicator(), MarketOverview(), SmartTipsPanel(), fromBybitSymbol(), useCryptoData() (+19 more)

### Community 15 - "react"
Cohesion: 0.13
Nodes (13): react, AlertsPanel(), AlertsPanelProps, MatrixBackground(), MatrixBackgroundProps, ScrollArea, ScrollBar, Switch (+5 more)

### Community 16 - "services/pathStudy.ts"
Cohesion: 0.11
Nodes (24): bucketKey(), buildPathTable(), BuildTableOptions, buildValidatedPathTable(), costInR(), DEFAULT_COST_R, EXIT_SLIPPAGE_PCT, measureBarPaths() (+16 more)

### Community 17 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 18 - "Gauge.tsx"
Cohesion: 0.57
Nodes (6): angleFor(), arcPath(), clamp(), Gauge(), GaugeProps, polarToXY()

### Community 19 - "simExecution.ts"
Cohesion: 0.11
Nodes (27): isInStreakCooldown(), streakCooldownFromHistory(), evaluateCorrelationGate(), toPositionDirection(), generatePathOrders(), PATH_ENTRY_ORDER_SIDES, pathEntryBudget(), uid() (+19 more)

### Community 20 - "manifest.json"
Cohesion: 0.11
Nodes (17): background_color, categories, description, dir, display, features, icons, lang (+9 more)

### Community 21 - "SimPosition"
Cohesion: 0.15
Nodes (32): FundingSnapshot, SignalEvaluation, MultiTimeframeSnapshot, PathOrderGenContext, Prev4hRangeOrderGenContext, ProRiskLevel, ProSignalResult, ProGateContext (+24 more)

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
Cohesion: 0.19
Nodes (6): IntradayAdapter, PathAdapter, DecisionEngine, DecisionContext, EngineAdapter, EngineId

### Community 26 - "toBaseAsset"
Cohesion: 0.19
Nodes (22): toBaseAsset(), createBybitSimEngine(), createPathSimEngine(), createProSimEngine(), createSimEngine(), createGenericSimEngine(), buildH1CandlesForSymbol(), buildM5CandlesForSymbol() (+14 more)

### Community 27 - "1. מנוע TrendBreakout המלא (`trendBreakout.ts` + `trendBreakoutExecution.ts`)"
Cohesion: 0.07
Nodes (29): 1.1 פרמטרים (spec §23), 1.2 זרימה (state machine — spec §6), 1.3 אינדיקטורים (סעיף 2 — closed candles only), 1.4 חישוב Score (סעיף 7), 1.5 Entry / SL / TP (סעיפים 9/10), 1.6 Stop management (סעיף 12), 1.7 Exits (סעיף 13), 1. מנוע TrendBreakout המלא (`trendBreakout.ts` + `trendBreakoutExecution.ts`) (+21 more)

### Community 28 - "prev4hRangeExecution.ts"
Cohesion: 0.13
Nodes (30): cappedTakeProfitLevels(), capStopLoss(), ExitLevel, isLongSide(), MAX_LOSS_PERCENT, maxLossStopLevel(), positionPnlPercent(), reachedStop() (+22 more)

### Community 29 - "threeBotIntegration.test.ts"
Cohesion: 0.15
Nodes (19): PathRegime, slotIndexAt(), BYBIT_SIM_BOT_LAST_KNOWN_RUNNING_KEY, PATH_SIM_BOT_LAST_KNOWN_RUNNING_KEY, PRO_SIM_BOT_STORAGE_KEY, SIM_BOT_STORAGE_KEY, AggregatableContext, AggregatedBot (+11 more)

### Community 30 - "components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 31 - "backtestCompare.ts"
Cohesion: 0.16
Nodes (16): BINANCE_INTERVAL, BybitKlineResponse, CONC, fetchBinance(), fetchBybit(), fetchJson(), fetchKlines(), FM_LIMIT (+8 more)

### Community 32 - "correlation.ts"
Cohesion: 0.13
Nodes (18): alignCloses(), clampNum(), CorrelatedHolding, CORRELATION_LOOKBACK_FLOOR, correlationBetween(), CorrelationGateInput, CorrelationGateResult, CorrelationMatch (+10 more)

### Community 33 - "simDefaults.ts"
Cohesion: 0.16
Nodes (17): MAX_TOTAL_EXPOSURE_PERCENT, POSITION_TARGET_PCT, PATH_MIN_H4_BARS, ConfidenceScale, riskLevelToMaxPositions(), SIM_BASE_DEFAULTS, SIM_BOT_IDS, SIM_BOT_SPECS (+9 more)

### Community 34 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit (+8 more)

### Community 35 - "cryptoPriceAggregator.ts"
Cohesion: 0.22
Nodes (12): CRYPTO_IDS, BinanceKlineRaw, BinanceTicker, CandleCache, coinGeckoPriceCache, fetchBinanceAllTickers(), fetchBybitAllTickers(), fetchCoinGeckoPrices() (+4 more)

### Community 36 - "dependencies"
Cohesion: 0.03
Nodes (59): dependencies, @capacitor/android, @capacitor/cli, @capacitor/core, @capacitor/ios, class-variance-authority, clsx, cmdk (+51 more)

### Community 37 - "bybitApi.ts"
Cohesion: 0.25
Nodes (7): TARGET_SYMBOLS, BybitKlineData, BybitTicker, toInternalSymbol(), fetchLiveUniverse(), getActiveSymbols(), resolveWorkerBaseUrl()

### Community 38 - "דוח אימות — האם ההחלטות בוצעו? (בדיקה אמפירית בקוד)"
Cohesion: 0.09
Nodes (21): ⚠️ אזהרה על הטסטים החדשים (`positionSizing.test.ts`), ✅ בוצע ואומת, דוח אימות — האם ההחלטות בוצעו? (בדיקה אמפירית בקוד), 🟡 חלקי, טבלת ההחלטות שלך — מצב בפועל, ❌ לא בוצע, ממצאים חדשים, ❌ נשאר פתוח (deliverables גדולים, 0% קוד) (+13 more)

### Community 39 - "analyzeDecisions.ts"
Cohesion: 0.21
Nodes (13): BUCKET_BOUNDS, BUCKET_LABELS, BucketStats, computeBuckets(), formatPercent(), getBucketIndex(), getTopReason(), main() (+5 more)

### Community 40 - "scan"
Cohesion: 0.24
Nodes (15): baseCoin(), bybitExec(), checkClosedFuturesPositions(), checkClosedSpotPositions(), confirmSpotEntries(), executeOrder(), fetchWithTimeout(), getAccountContext() (+7 more)

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

### Community 49 - "analysis.ts"
Cohesion: 0.10
Nodes (32): FUNDING_CROWDED_ANNUAL_PCT, FUNDING_EXTREME_ANNUAL_PCT, FUNDING_MAX_AGE_MS, FUNDING_MIN_SIZE_MULTIPLIER, FUNDING_PERIODS_PER_YEAR, FundingVerdict, BacktestHistory, BacktestMetrics (+24 more)

### Community 50 - "BacktestResults.tsx"
Cohesion: 0.22
Nodes (16): useBybitSimulationBotContext(), usePathSimulationBotContext(), useProSimulationBotContext(), useSimulationBotContext(), useWorkerAuth(), BacktestResults(), BotInput, BotKey (+8 more)

### Community 51 - "errorHandlerSanitizer.test.ts"
Cohesion: 0.06
Nodes (34): normalizeItem(), Binance24hTicker, BinanceKline, binancePublicApi, AlternativeMeResponse, fearGreedApi, fetchDirect(), fetchFromWorker() (+26 more)

### Community 52 - "PortfolioPulseCard.tsx"
Cohesion: 0.13
Nodes (16): getAggregatedCandles(), recharts, LivePositionChart(), LivePositionChartProps, HistoryPoint, Metric, PortfolioPulseCard(), Props (+8 more)

### Community 53 - "cn"
Cohesion: 0.08
Nodes (41): class-variance-authority, @radix-ui/react-dropdown-menu, CryptoChart(), CryptoChartProps, CryptoDetailModal(), CryptoDetailModalProps, safeNumber(), safeNumber() (+33 more)

### Community 54 - "intradaySetup.ts"
Cohesion: 0.26
Nodes (18): BollingerResult, CompressionResult, MacdResult, MarketStructureResult, ramp(), StochasticResult, VwapResult, detectSetup15M() (+10 more)

### Community 55 - "proAlgEngine.ts"
Cohesion: 0.05
Nodes (74): calculateOptimalEntryPrice(), computeProSignal(), PRO_ALLOCATION_DEFAULT_PERCENT, PRO_ALLOCATION_HIGH_CONFIDENCE_THRESHOLD, PRO_ALLOCATION_HIGH_PERCENT, PRO_CONFIDENCE_BY_RISK, PRO_COVERAGE_FULL_WEIGHT, PRO_DEFAULT_ENTRY_CONFIDENCE (+66 more)

### Community 56 - "src/index.ts"
Cohesion: 0.08
Nodes (47): buildExitView(), buildFactorsFromDecisionResult(), buildPortfolioRiskStats(), evaluatePositionExit(), evaluateSymbolFromSnapshot(), evaluateUniverse(), EvaluateUniverseOptions, ExitPortfolioInput (+39 more)

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
Cohesion: 0.18
Nodes (14): ExecutiveDashboard(), DEFAULT_PRO_CONFIG, ProSimulationBotContext, ProSimulationBotProvider(), useProSimulationBotContextSafe(), useSimulationBotContextSafe(), useApiPolling(), RealTradingBot() (+6 more)

### Community 61 - "useApiPollingCascade.test.ts"
Cohesion: 0.25
Nodes (4): createHarness(), depsEqual(), Harness, PollFn

### Community 62 - "shutdown"
Cohesion: 0.25
Nodes (8): exportMarketDataCache(), persistBybitSim(), persistMarketCache(), persistPathSim(), persistProSim(), persistSim(), serializeState(), shutdown()

### Community 63 - "proConfidenceProfile.ts"
Cohesion: 0.52
Nodes (6): arg(), klines(), main(), q(), share(), topSymbols()

### Community 64 - "דוח אנליסט — סתירות ובאגים בדף "השוואת ביצועי הבוטים""
Cohesion: 0.14
Nodes (13): 🔴 F-1 — בסיס ההון מקודד קשיח ל-‎$10,000‎ (שורש ה-−90%), 🔴 F-2 — שורת ה-"סה"כ" סובלת מאותו באג, מוכפל פי 4, 🟠 F-3 — שני מדדי P&L שונים מוצגים זה לצד זה בלי הבחנה, 🟠 F-4 — `hasServerData` לא נבדק: בוט מנותק נספר כ-"שטוח, 0%", 🟡 F-5 — הדף מחשב מחדש Win Rate / מספר עסקאות במקום להשתמש בנתוני השרת, 🟡 F-6 — אין בדיקת-שפיות (reconciliation) על המסך, דוח אנליסט — סתירות ובאגים בדף "השוואת ביצועי הבוטים", הערכת אנליסט (+5 more)

### Community 65 - "intradayIndicators.ts"
Cohesion: 0.21
Nodes (26): confirmEntry5M(), emptyEntry(), atrRegime(), bollinger(), candleQuality, compression(), findSwings(), last() (+18 more)

### Community 68 - "intradayEngine.ts"
Cohesion: 0.20
Nodes (18): DecisionOutcome, IntradayDecision, IntradayDecisionInput, Entry5M, IntradayExitContext, DecisionGate, Direction, EntryTrigger (+10 more)

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

### Community 84 - "Candle"
Cohesion: 0.09
Nodes (29): Prev4hRangeInput, Prev4hRangeCandleSet, OrderGenContext, breakoutLimitPrice(), Candle, clamp01(), computeConfidence(), ConfidenceInput (+21 more)

### Community 85 - "trendBreakoutExecution.ts"
Cohesion: 0.09
Nodes (30): DecisionFactor, CAPITAL_FLOOR_PCT, DAILY_DRAWDOWN_BLOCK_PERCENT, isBelowCapitalFloor(), PER_ASSET_EXPOSURE_CAP_PERCENT, resolveSizingBase(), WEEKLY_DRAWDOWN_LOCK_PERCENT, evaluateProExit() (+22 more)

### Community 86 - "PortfolioBuilder.tsx"
Cohesion: 0.23
Nodes (10): PortfolioItem, AddCryptoForm(), AddCryptoFormProps, CurrentPortfolioItems(), CurrentPortfolioItemsProps, PortfolioSummary(), PortfolioSummaryProps, PortfolioBuilder() (+2 more)

### Community 87 - "intradayAdapter.ts"
Cohesion: 0.14
Nodes (23): ClosedTradeRecord, CircuitBreakerStage, ExposureStage, intradayResultCache, mapDirection(), mapOutcome(), mapRiskPlan(), mapTradeType() (+15 more)

### Community 88 - "PathSimulationBotContext.tsx"
Cohesion: 0.27
Nodes (9): DEFAULT_PATH_CONFIG, EMPTY_SNAPSHOT, PathSimulationBotContext, PathSimulationBotProvider(), getPathSimState(), resetPathSim(), setPathSimConfig(), startPathSim() (+1 more)

### Community 89 - "pathEngine.ts"
Cohesion: 0.16
Nodes (15): MIN_PATH_CANDLES, PATH_MAX_HOLD_MS, PATH_TIME_STOP_MS, PathDecision, PathDecisionInput, PathGate, pathKellyFraction(), BAR_MS (+7 more)

### Community 90 - "vitest"
Cohesion: 0.11
Nodes (25): weightedAverageExit(), emptyDecision(), evaluateIntradayDecision(), finalize(), isFullParams(), clamp(), DEFAULT_INTRADAY_PARAMS, withParams() (+17 more)

### Community 91 - "emaSeedingImpact.ts"
Cohesion: 0.33
Nodes (10): Candle, clamp01(), emaShipped(), emaTextbook(), fetchKlines(), last(), main(), pct() (+2 more)

### Community 92 - "WorkerAuthContext.tsx"
Cohesion: 0.48
Nodes (5): WorkerAuthContext, WorkerAuthContextValue, WorkerAuthProvider(), resolveWorkerBaseUrlWithSource(), UrlSource

### Community 93 - "scripts/pathStudy.ts"
Cohesion: 0.18
Nodes (16): buildWalkForwardWindows(), CandleOrdering, DEFAULT_TP_R, DEFAULT_USE_FEAR_GREED, RiskBasis, ValidatedBucket, arg(), cmdBuild() (+8 more)

### Community 94 - "useSimulationBot.ts"
Cohesion: 0.23
Nodes (13): computeAtr5(), MIN_PRO_CANDLES, SIM_MIN_CONFIDENCE, selectFillableOrders(), CryptoData, PortfolioBuilderProps, useBackgroundWorker(), UseBackgroundWorkerOptions (+5 more)

### Community 95 - "pathValidation.test.ts"
Cohesion: 0.20
Nodes (12): buildFearGreedSeries(), fearGreedAt(), FearGreedPoint, FearGreedSeries, fetchFearGreedHistory(), parseFearGreedPayload(), utcDayStart(), fearGreedBucket (+4 more)

### Community 96 - "LiveBoard.tsx"
Cohesion: 0.24
Nodes (13): ACCENT, accentOf(), BotCard(), clock(), LiveBoard(), pct(), price(), SIDE_LABEL (+5 more)

### Community 97 - "evaluatePathDecision"
Cohesion: 0.23
Nodes (12): aggregateToH4(), evaluatePathDecision(), noSignal(), pathRiskUnit(), barOpenFor(), labelBarState(), lookbackForBasis(), prior15mFor() (+4 more)

### Community 98 - "fillDueOrders"
Cohesion: 0.22
Nodes (7): fillDueOrders(), MIN_SIM_ENTRY_USD, uid(), simulateSlippage(), candles, r, fill()

### Community 99 - "fundingOrthogonality.ts"
Cohesion: 0.36
Nodes (8): annualisedFundingPct(), evaluateFundingGate(), fetchFundingHistory(), FundingPoint, main(), OUT_DIR, pearson(), Snapshot

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
- **733 isolated node(s):** `config`, `$schema`, `style`, `rsc`, `tsx` (+728 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 865 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `CI Workflow (GitHub Actions)` and `CI Workflow (GitHub Actions)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `react` connect `react` to `LiveBoard.tsx`, `lucide-react`, `tradingApiClient.ts`, `Portfolio.tsx`, `package.json`, `hooks/use-toast.ts`, `App.tsx`, `WorkerAuthContext.tsx`, `Gauge.tsx`, `errorHandlerSanitizer.test.ts`, `PortfolioPulseCard.tsx`, `cn`, `PortfolioBuilder.tsx`, `BacktestResults.tsx`, `PathSimulationBotContext.tsx`, `ProSimulationBotContext.tsx`, `useSimulationBot.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `vitest` connect `vitest` to `backtestRunner.ts`, `marketDataService.test.ts`, `execution.ts`, `simExecution.ts`, `SimPosition`, `prev4hRangeExecution.ts`, `threeBotIntegration.test.ts`, `correlation.ts`, `simDefaults.ts`, `analysis.ts`, `errorHandlerSanitizer.test.ts`, `proAlgEngine.ts`, `src/index.ts`, `ProSimulationBotContext.tsx`, `useApiPollingCascade.test.ts`, `package.json`, `Candle`, `trendBreakoutExecution.ts`, `pathEngine.ts`, `pathValidation.test.ts`, `fillDueOrders`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `config`, `$schema`, `style` to the rest of the system?**
  _733 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `backtestSweep.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06015037593984962 - nodes in this community are weakly interconnected._
- **Should `backtestRunner.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0660377358490566 - nodes in this community are weakly interconnected._