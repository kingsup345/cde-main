# Graph Report - crypto-decision-engine-main  (2026-09-08)

## Corpus Check
- 218 files · ~226,992 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2190 nodes · 5613 edges · 100 communities (84 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2fd54783`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- backtestSweep.ts
- Portfolio.tsx
- backtestRunner.ts
- tradingApiClient.ts
- tradingWorker.ts
- PipelineStage
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
- PortfolioRiskMeter.tsx
- simExecution.ts
- manifest.json
- useSimulationBot.ts
- market-data.ts
- compilerOptions
- compilerOptions
- DecisionContext
- toBybitSymbol
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
- intradayBridge.ts
- BacktestResults.tsx
- errorHandlerSanitizer.test.ts
- SimulationEngineColumn.tsx
- cn
- vitest
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
- CryptoDetailModal.tsx
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
- analysis.ts
- pathSimExecution.ts
- badge.tsx
- intradayAdapter.ts
- PathSimulationBotContext.tsx
- BybitSimulationBotContext.tsx
- Candle
- emaSeedingImpact.ts
- WorkerAuthContext.tsx
- binanceUnlistedSymbols.test.ts
- eslint.config.js
- service-worker.js
- tailwindcss
- vite.config.ts

## God Nodes (most connected - your core abstractions)
1. `Candle` - 68 edges
2. `cn()` - 65 edges
3. `react` - 60 edges
4. `SimPosition` - 43 edges
5. `SignalEvaluation` - 40 edges
6. `PendingOrder` - 39 edges
7. `lucide-react` - 38 edges
8. `SimBotConfig` - 31 edges
9. `SimTrade` - 30 edges
10. `vitest` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Placeholder Image Icon SVG` --conceptually_related_to--> `Crypto Decision Engine SPA Entry (index.html)`  [INFERRED]
  public/placeholder.svg → index.html
- `toInternalSymbol()` --calls--> `toBaseAsset()`  [EXTRACTED]
  src/services/bybitApi.ts → packages/engine/src/services/assetUniverse.ts
- `ScanResult` --references--> `IntradayDecision`  [EXTRACTED]
  server/tradingWorker.ts → packages/engine/src/services/intradayEngine.ts
- `BotInput` --references--> `SimPosition`  [EXTRACTED]
  src/pages/BacktestResults.tsx → packages/engine/src/services/simExecution.ts
- `TradeRow` --inherits--> `SimTrade`  [EXTRACTED]
  src/pages/BacktestResults.tsx → packages/engine/src/services/simExecution.ts

## Import Cycles
- None detected.

## Communities (100 total, 11 thin omitted)

### Community 0 - "backtestSweep.ts"
Cohesion: 0.06
Nodes (37): buildGrid(), Combo, ComboResult, CONC, DAYS, ENTRY_MIN, fetchHistory(), fetchKlinesPaged() (+29 more)

### Community 1 - "Portfolio.tsx"
Cohesion: 0.11
Nodes (35): PortfolioAnalysis, lucide-react, recharts, AIChatbot(), AIChatbotProps, Message, CryptoCard(), safeNumber() (+27 more)

### Community 2 - "backtestRunner.ts"
Cohesion: 0.06
Nodes (48): calculateTradingFee(), TradeSide, arg(), argNum(), Candle, cmdRun(), cmdSnapshot(), cmdSnapshotMtf() (+40 more)

### Community 3 - "tradingApiClient.ts"
Cohesion: 0.13
Nodes (22): DEFAULT_CONFIG, SimulationBotContext, SimulationBotProvider(), useFearGreedIndex(), useServerSimDefaults(), ArchivedRun, BacktestArchiveResponse, clearBacktestArchive() (+14 more)

### Community 4 - "tradingWorker.ts"
Cohesion: 0.03
Nodes (56): BybitSimSnapshot, PathSimSnapshot, ProSimSnapshot, allowedOrigins, archiveStore, botSymbolsRaw, bybitSimEngine, bybitSimState (+48 more)

### Community 5 - "PipelineStage"
Cohesion: 0.24
Nodes (6): CircuitBreakerStage, ExposureStage, RunEngineStage, ValidateInputStage, PipelineStage, StageResult

### Community 6 - "marketDataService.ts"
Cohesion: 0.10
Nodes (26): binanceListsSymbol(), BybitKlineResponse, BybitTickerRow, CandleSource, CandleValidationResult, clearFundingCache(), fetchBinanceKlines(), fetchBinanceSymbols() (+18 more)

### Community 7 - "marketDataService.test.ts"
Cohesion: 0.18
Nodes (9): clearMarketDataCache(), dropFormingCandle(), fetchBacktestHistory(), fetchTimeframe(), isAlignedToTimeframe(), TIMEFRAME_SPECS, validateCandles(), buildBybitRows() (+1 more)

### Community 8 - "execution.ts"
Cohesion: 0.09
Nodes (39): AdaptiveRiskInput, adaptiveRiskPercentFromHistory(), computeAdaptiveRiskPercent(), computeDrawdownFactor(), computeSizingMultiplier(), computeStreakFactor(), computeSymbolStreakCooldownUntil(), computeWinRateFactor() (+31 more)

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
Cohesion: 0.07
Nodes (37): CryptoRecommendation, react-router-dom, @tanstack/react-query, queryClient, CryptoCardProps, MarketOverview(), MarketOverviewProps, MatrixBackground() (+29 more)

### Community 15 - "react"
Cohesion: 0.23
Nodes (7): react, AlertsPanel(), AlertsPanelProps, Particle, ParticleBackground(), Alert, useAlerts()

### Community 16 - "services/pathStudy.ts"
Cohesion: 0.05
Nodes (79): buildFearGreedSeries(), fearGreedAt(), FearGreedPoint, FearGreedSeries, fetchFearGreedHistory(), parseFearGreedPayload(), utcDayStart(), aggregateToH4() (+71 more)

### Community 17 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 18 - "PortfolioRiskMeter.tsx"
Cohesion: 0.22
Nodes (13): FearGreedIndex, FEAR_GREED_ZONES, FearGreedIndicator(), FearGreedIndicatorProps, angleFor(), arcPath(), clamp(), Gauge() (+5 more)

### Community 19 - "simExecution.ts"
Cohesion: 0.08
Nodes (23): DEFAULT_POSITION_PERCENT, ENTRY_COOLDOWN_MS, ENTRY_ORDER_SIDES, EntryBudgetInput, EXIT_ORDER_SIDES, FillableOrdersResult, FillEvent, FillResult (+15 more)

### Community 20 - "manifest.json"
Cohesion: 0.11
Nodes (17): background_color, categories, description, dir, display, features, icons, lang (+9 more)

### Community 21 - "useSimulationBot.ts"
Cohesion: 0.06
Nodes (87): toBaseAsset(), FundingSnapshot, buildFactorsFromDecisionResult(), computeAtr5(), DecisionFactor, resolveTradeSide(), SignalEvaluation, MultiTimeframeSnapshot (+79 more)

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
Cohesion: 0.20
Nodes (7): IntradayAdapter, PathAdapter, DecisionEngine, DecisionContext, DecisionResult, EngineAdapter, EngineId

### Community 26 - "toBybitSymbol"
Cohesion: 0.22
Nodes (13): toBybitSymbol(), evaluateUniverse(), cacheKey(), exportMarketDataCache(), fetchLiquiditySnapshots(), getLiquiditySnapshots(), getMultiTimeframeData(), getUniverseMarketData() (+5 more)

### Community 27 - "1. מנוע TrendBreakout המלא (`trendBreakout.ts` + `trendBreakoutExecution.ts`)"
Cohesion: 0.07
Nodes (29): 1.1 פרמטרים (spec §23), 1.2 זרימה (state machine — spec §6), 1.3 אינדיקטורים (סעיף 2 — closed candles only), 1.4 חישוב Score (סעיף 7), 1.5 Entry / SL / TP (סעיפים 9/10), 1.6 Stop management (סעיף 12), 1.7 Exits (סעיף 13), 1. מנוע TrendBreakout המלא (`trendBreakout.ts` + `trendBreakoutExecution.ts`) (+21 more)

### Community 28 - "prev4hRangeExecution.ts"
Cohesion: 0.10
Nodes (18): DAILY_DRAWDOWN_BLOCK_PERCENT, PER_ASSET_EXPOSURE_CAP_PERCENT, WEEKLY_DRAWDOWN_LOCK_PERCENT, DEFAULT_PREV4H_RANGE_PARAMS, PREV4H_MIN_H1_CANDLES, Prev4hRangeParams, Prev4hRangePlan, readPrev4hRangePlan() (+10 more)

### Community 29 - "threeBotIntegration.test.ts"
Cohesion: 0.17
Nodes (17): BYBIT_SIM_BOT_LAST_KNOWN_RUNNING_KEY, PATH_SIM_BOT_LAST_KNOWN_RUNNING_KEY, PRO_SIM_BOT_STORAGE_KEY, SIM_BOT_STORAGE_KEY, AggregatableContext, AggregatedBot, CombinedRisk, combineRisk() (+9 more)

### Community 30 - "components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 31 - "backtestCompare.ts"
Cohesion: 0.16
Nodes (16): BINANCE_INTERVAL, BybitKlineResponse, CONC, fetchBinance(), fetchBybit(), fetchJson(), fetchKlines(), FM_LIMIT (+8 more)

### Community 32 - "correlation.ts"
Cohesion: 0.16
Nodes (15): alignCloses(), clampNum(), CorrelatedHolding, CORRELATION_LOOKBACK_FLOOR, correlationBetween(), CorrelationGateInput, CorrelationMatch, DEFAULT_CORRELATION_LOOKBACK (+7 more)

### Community 33 - "simDefaults.ts"
Cohesion: 0.15
Nodes (18): MAX_TOTAL_EXPOSURE_PERCENT, POSITION_TARGET_PCT, MIN_PATH_CANDLES, PATH_MIN_H4_BARS, ConfidenceScale, riskLevelToMaxPositions(), SIM_BASE_DEFAULTS, SIM_BOT_IDS (+10 more)

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
Cohesion: 0.23
Nodes (8): TARGET_SYMBOLS, BybitKlineData, BybitTicker, toInternalSymbol(), fetchFromWorker(), fetchLiveUniverse(), getActiveSymbols(), resolveWorkerBaseUrl()

### Community 38 - "דוח אימות — האם ההחלטות בוצעו? (בדיקה אמפירית בקוד)"
Cohesion: 0.09
Nodes (21): ⚠️ אזהרה על הטסטים החדשים (`positionSizing.test.ts`), ✅ בוצע ואומת, דוח אימות — האם ההחלטות בוצעו? (בדיקה אמפירית בקוד), 🟡 חלקי, טבלת ההחלטות שלך — מצב בפועל, ❌ לא בוצע, ממצאים חדשים, ❌ נשאר פתוח (deliverables גדולים, 0% קוד) (+13 more)

### Community 39 - "analyzeDecisions.ts"
Cohesion: 0.21
Nodes (13): BUCKET_BOUNDS, BUCKET_LABELS, BucketStats, computeBuckets(), formatPercent(), getBucketIndex(), getTopReason(), main() (+5 more)

### Community 40 - "scan"
Cohesion: 0.20
Nodes (17): buildPortfolioRiskStats(), baseCoin(), bybitExec(), checkClosedFuturesPositions(), checkClosedSpotPositions(), confirmSpotEntries(), executeOrder(), fetchWithTimeout() (+9 more)

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
Cohesion: 0.08
Nodes (58): BacktestMetrics, BacktestResult, BacktestTrade, computeMetrics(), OpenPosition, PendingOrder, runBacktest(), runRiskVariants() (+50 more)

### Community 50 - "BacktestResults.tsx"
Cohesion: 0.22
Nodes (16): useBybitSimulationBotContext(), usePathSimulationBotContext(), useProSimulationBotContext(), useSimulationBotContext(), useWorkerAuth(), BacktestResults(), BotInput, BotKey (+8 more)

### Community 51 - "errorHandlerSanitizer.test.ts"
Cohesion: 0.06
Nodes (36): createDefaultPortfolio(), isPortfolioShaped(), normalizeItem(), usePortfolio(), Binance24hTicker, BinanceKline, binancePublicApi, AlternativeMeResponse (+28 more)

### Community 52 - "SimulationEngineColumn.tsx"
Cohesion: 0.12
Nodes (21): HistoryPoint, Metric, PortfolioPulseCard(), Props, RANGE_LABEL, RANGE_MS, TimeRange, toneClass() (+13 more)

### Community 53 - "cn"
Cohesion: 0.10
Nodes (28): @radix-ui/react-dropdown-menu, Alert, AlertDescription, AlertTitle, alertVariants, CardDescription, CardFooter, DropdownMenuCheckboxItem (+20 more)

### Community 54 - "vitest"
Cohesion: 0.11
Nodes (12): applyFundingAccrual(), SIM_INTRADAY_PARAMS_OVERRIDE, DEFAULT_TREND_BREAKOUT_PARAMS, TrendBreakoutPlan, vitest, baseCtx, SW_SOURCE, SETUPS (+4 more)

### Community 55 - "proAlgEngine.ts"
Cohesion: 0.05
Nodes (69): calculateOptimalEntryPrice(), computeProSignal(), PRO_ALLOCATION_DEFAULT_PERCENT, PRO_ALLOCATION_HIGH_CONFIDENCE_THRESHOLD, PRO_ALLOCATION_HIGH_PERCENT, PRO_CONFIDENCE_BY_RISK, PRO_COVERAGE_FULL_WEIGHT, PRO_DEFAULT_ENTRY_CONFIDENCE (+61 more)

### Community 56 - "src/index.ts"
Cohesion: 0.12
Nodes (28): EvaluateUniverseOptions, ExitPortfolioInput, fetchSymbolSnapshot(), PortfolioInput, ActivePosition, BollingerBands, CryptoChartData, EnhancedCryptoData (+20 more)

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
Cohesion: 0.19
Nodes (14): ExecutiveDashboard(), DEFAULT_PRO_CONFIG, ProSimulationBotContext, ProSimulationBotProvider(), useProSimulationBotContextSafe(), useSimulationBotContextSafe(), useApiPolling(), UseApiPollingOptions (+6 more)

### Community 61 - "useApiPollingCascade.test.ts"
Cohesion: 0.25
Nodes (4): createHarness(), depsEqual(), Harness, PollFn

### Community 62 - "shutdown"
Cohesion: 0.40
Nodes (5): persistBybitSim(), persistPathSim(), persistProSim(), persistSim(), shutdown()

### Community 63 - "proConfidenceProfile.ts"
Cohesion: 0.52
Nodes (6): arg(), klines(), main(), q(), share(), topSymbols()

### Community 64 - "דוח אנליסט — סתירות ובאגים בדף "השוואת ביצועי הבוטים""
Cohesion: 0.14
Nodes (13): 🔴 F-1 — בסיס ההון מקודד קשיח ל-‎$10,000‎ (שורש ה-−90%), 🔴 F-2 — שורת ה-"סה"כ" סובלת מאותו באג, מוכפל פי 4, 🟠 F-3 — שני מדדי P&L שונים מוצגים זה לצד זה בלי הבחנה, 🟠 F-4 — `hasServerData` לא נבדק: בוט מנותק נספר כ-"שטוח, 0%", 🟡 F-5 — הדף מחשב מחדש Win Rate / מספר עסקאות במקום להשתמש בנתוני השרת, 🟡 F-6 — אין בדיקת-שפיות (reconciliation) על המסך, דוח אנליסט — סתירות ובאגים בדף "השוואת ביצועי הבוטים", הערכת אנליסט (+5 more)

### Community 65 - "tradeEngine.ts"
Cohesion: 0.13
Nodes (49): confirmEntry5M(), emptyEntry(), atrRegime(), AtrRegimeResult, bollinger(), BollingerResult, candleQuality, clamp() (+41 more)

### Community 68 - "CryptoDetailModal.tsx"
Cohesion: 0.27
Nodes (10): CryptoChartProps, CryptoDetailModal(), CryptoDetailModalProps, safeNumber(), DialogContent, DialogDescription, DialogFooter(), DialogHeader() (+2 more)

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

### Community 79 - "SCOPING — Limit/Market toggle + dynamic Risk Profile, for all 4 sim bots"
Cohesion: 0.17
Nodes (11): 0. Worker URL — `cde-main.onrender.com` (תיקון קטן), 1. Limit / Market toggle — מצב נוכחי לכל בוט, 2. פרופיל סיכון (low / medium / high) — מצב נוכחי, 3. Intraday → מודל `equity × 10%` (מההודעה הקודמת), 4. סיכום קבצים + הכרעות פתוחות, SCOPING — Limit/Market toggle + dynamic Risk Profile, for all 4 sim bots, ✅ בוצע (2026-09-07), הכרעות שצריך ממך לפני ביצוע (+3 more)

### Community 84 - "analysis.ts"
Cohesion: 0.12
Nodes (30): annualisedFundingPct(), evaluateFundingGate(), FUNDING_CROWDED_ANNUAL_PCT, FUNDING_EXTREME_ANNUAL_PCT, FUNDING_MAX_AGE_MS, FUNDING_MIN_SIZE_MULTIPLIER, FUNDING_PERIODS_PER_YEAR, FundingVerdict (+22 more)

### Community 85 - "pathSimExecution.ts"
Cohesion: 0.16
Nodes (24): isInStreakCooldown(), streakCooldownFromHistory(), evaluateCorrelationGate(), toPositionDirection(), generatePathOrders(), PATH_ENTRY_ORDER_SIDES, pathEntryBudget(), uid() (+16 more)

### Community 86 - "badge.tsx"
Cohesion: 0.16
Nodes (15): getAggregatedCandles(), PortfolioItem, class-variance-authority, AddCryptoForm(), AddCryptoFormProps, CurrentPortfolioItems(), CurrentPortfolioItemsProps, LivePositionChart() (+7 more)

### Community 87 - "intradayAdapter.ts"
Cohesion: 0.16
Nodes (20): ClosedTradeRecord, CorrelationGateResult, intradayResultCache, mapDirection(), mapOutcome(), mapRiskPlan(), mapTradeType(), PathEngineParams (+12 more)

### Community 88 - "PathSimulationBotContext.tsx"
Cohesion: 0.24
Nodes (10): DEFAULT_PATH_CONFIG, EMPTY_SNAPSHOT, PathSimulationBotContext, PathSimulationBotProvider(), getPathSimState(), PathSimBotStateResponse, resetPathSim(), setPathSimConfig() (+2 more)

### Community 89 - "BybitSimulationBotContext.tsx"
Cohesion: 0.24
Nodes (10): BybitSimulationBotContext, BybitSimulationBotProvider(), DEFAULT_BYBIT_CONFIG, EMPTY_SNAPSHOT, BybitSimBotStateResponse, getBybitSimState(), resetBybitSim(), setBybitSimConfig() (+2 more)

### Community 90 - "Candle"
Cohesion: 0.16
Nodes (15): BacktestHistory, Candle, fetchFundingHistory(), FundingPoint, main(), OUT_DIR, pearson(), Snapshot (+7 more)

### Community 91 - "emaSeedingImpact.ts"
Cohesion: 0.33
Nodes (10): Candle, clamp01(), emaShipped(), emaTextbook(), fetchKlines(), last(), main(), pct() (+2 more)

### Community 92 - "WorkerAuthContext.tsx"
Cohesion: 0.48
Nodes (5): WorkerAuthContext, WorkerAuthContextValue, WorkerAuthProvider(), resolveWorkerBaseUrlWithSource(), UrlSource

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
- **722 isolated node(s):** `config`, `$schema`, `style`, `rsc`, `tsx` (+717 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 851 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `CI Workflow (GitHub Actions)` and `CI Workflow (GitHub Actions)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `correlation.ts`, `simDefaults.ts`, `backtestRunner.ts`, `package.json`, `marketDataService.test.ts`, `execution.ts`, `services/pathStudy.ts`, `intradayBridge.ts`, `threeBotIntegration.test.ts`, `errorHandlerSanitizer.test.ts`, `simExecution.ts`, `useSimulationBot.ts`, `useApiPollingCascade.test.ts`, `proAlgEngine.ts`, `Candle`, `prev4hRangeExecution.ts`, `binanceUnlistedSymbols.test.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `Portfolio.tsx`, `tradingApiClient.ts`, `CryptoDetailModal.tsx`, `package.json`, `hooks/use-toast.ts`, `App.tsx`, `WorkerAuthContext.tsx`, `PortfolioRiskMeter.tsx`, `errorHandlerSanitizer.test.ts`, `SimulationEngineColumn.tsx`, `cn`, `badge.tsx`, `useSimulationBot.ts`, `PathSimulationBotContext.tsx`, `BybitSimulationBotContext.tsx`, `BacktestResults.tsx`, `ProSimulationBotContext.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `config`, `$schema`, `style` to the rest of the system?**
  _722 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `backtestSweep.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05786090005844535 - nodes in this community are weakly interconnected._
- **Should `Portfolio.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11137254901960784 - nodes in this community are weakly interconnected._