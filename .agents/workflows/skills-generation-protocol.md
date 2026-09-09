---
description: SKILLS GENERATION & PROJECT RULES PROTOCOL PURPOSE  This protocol controls how the agent discovers, creates, updates, and uses Skills for every project.  The objective is NOT to create as many Skills as possible.
---

The objective is:

Create only the Skills that provide real, reusable, project-relevant expertise or operational rules.


# 1. SKILL PRINCIPLE

A Skill is a reusable body of specialized knowledge that improves:

* Accuracy
* Consistency
* Reliability
* Maintainability
* Testing
* Domain-specific decision making

A Skill is NOT simply another task description.

---

# 2. WHEN TO CREATE A SKILL

Create a Skill when at least one of these conditions applies:

1. The project contains a specialized technical domain.
2. The project contains complex recurring rules.
3. The same procedure will be repeated multiple times.
4. The domain requires specialized validation.
5. Existing Skills do not adequately cover the requirement.
6. The Skill can be reused in future tasks/projects.

---

# 3. WHEN NOT TO CREATE A SKILL

Do NOT create a Skill for:

* One-time trivial tasks
* Simple CRUD
* Basic variable naming
* Generic coding
* A single small bug
* Temporary implementation details
* Information already fully covered by another Skill

Avoid Skill duplication.

---

# 4. SKILL DISCOVERY

Before creating a Skill:

1. Search existing Skills.
2. Determine whether an equivalent exists.
3. Determine whether an existing Skill can be extended.
4. Determine whether the new requirement is truly reusable.
5. Only then create a new Skill.

Never create duplicate Skills with slightly different names.

---

# 5. SKILL NAMING

Use clear lowercase names with hyphens.

Good:

```text
market-data-validation
multi-timeframe-analysis
firebase-security
incremental-data-sync
api-error-handling
deployment-verification
```

Bad:

```text
coolSkill
mySkill2
helper
newThing
cryptoStuff
```

The name must communicate the Skill's purpose.

---

# 6. SKILL STRUCTURE

Every Skill must contain:

```text
NAME
PURPOSE
SCOPE
WHEN TO USE
WHEN NOT TO USE
INPUTS
OUTPUTS
RULES
WORKFLOW
VALIDATION
ERROR HANDLING
EDGE CASES
ANTI-PATTERNS
TESTING
```

---

# 7. SKILL QUALITY STANDARD

A Skill must be:

* Specific
* Reusable
* Deterministic
* Testable
* Understandable
* Relevant
* Maintainable

Avoid vague statements such as:

```text
"Do things correctly."
"Use best practices."
"Be smart."
```

Rules must be operational.

---

# 8. SKILL EXAMPLE

Example:

```text
SKILL: market-data-validation

PURPOSE:
Validate OHLCV market data before it enters the analysis pipeline.

RULES:
- Timestamp must be finite and positive.
- Open, high, low, close must be finite and positive.
- High must be >= Low.
- Volume must be finite and >= 0.
- Duplicate candles must be removed.
- Candles must be ordered chronologically.
- Currently-forming candles must be excluded when required.
- Minimum candle requirements must be enforced.

FAILURE:
Return an explicit validation failure.
Never fabricate missing candles.
Never silently convert invalid data into valid data.
```

---

# 9. SKILL DEPENDENCIES

Skills may depend on other Skills.

Example:

```text
market-data-validation
        ↓
multi-timeframe-analysis
        ↓
signal-validation
        ↓
risk-management
```

Do not create circular Skill dependencies.

---

# 10. PROJECT-SPECIFIC SKILLS

A project may require Skills that are not global.

Example crypto project:

```text
crypto-market-analysis
market-data-validation
multi-timeframe-analysis
exchange-api-integration
technical-analysis
risk-management
signal-validation
```

Example scraper:

```text
web-data-extraction
pagination
incremental-sync
deduplication
data-normalization
rate-limit-management
failure-recovery
```

Example SaaS:

```text
saas-architecture
authentication
authorization
database-design
api-design
security
billing
testing
deployment
```

---

# 11. SKILL SELECTION MATRIX

For every project create:

```text
SKILL
RELEVANCE
EXISTS
REUSE
UPDATE
CREATE
PRIORITY
```

Use:

```text
REQUIRED
RECOMMENDED
OPTIONAL
NOT REQUIRED
```

---

# 12. PROJECT RULE GENERATION

After Skills are identified, generate Project Rules.

Project Rules define project-specific behavior.

Examples:

```text
DATA SOURCE PRIORITY
API CONTRACTS
DATABASE RULES
TIMEFRAME RULES
ERROR RULES
SECURITY RULES
DEPLOYMENT RULES
NAMING RULES
TESTING RULES
```

---

# 13. GLOBAL VS PROJECT RULES

Never put project-specific behavior into Global Rules unless it applies universally.

Example:

```text
GLOBAL RULE:
Never fabricate market data.

PROJECT RULE:
Bybit is the primary OHLCV provider.
Binance is the fallback.
CoinGecko must not be used for intraday OHLCV.
```

Global = always.

Project = current project.

---

# 14. RULE PRIORITY

When rules conflict:

```text
GLOBAL SAFETY / INTEGRITY
↓
GLOBAL RULES
↓
PROJECT RULES
↓
PROJECT SKILLS
↓
TASK REQUIREMENTS
```

However, explicit user requirements must be respected unless they conflict with safety, security, or technical impossibility.

---

# 15. SKILL UPDATE RULE

Update an existing Skill instead of creating a new one when:

* The subject is the same.
* The new requirement extends the existing knowledge.
* The new behavior is reusable.
* Splitting the Skill would create duplication.

Create a new Skill when the domain is meaningfully different.

---

# 16. SKILL VERSIONING

When a Skill changes significantly, preserve its history where the platform supports versioning.

Record:

```text
VERSION
DATE
CHANGE
REASON
IMPACT
```

Do not silently change critical rules without understanding their impact.

---

# 17. SKILL VALIDATION

Before activating a new Skill, verify:

```text
Does it solve a real problem?
Is it reusable?
Is it specific?
Is it non-duplicative?
Is it testable?
Does it conflict with existing rules?
Does it introduce unnecessary complexity?
```

If the answer to these questions is negative, do not create the Skill.

---

# 18. SKILL ANTI-PATTERNS

Never create:

```text
100 tiny Skills
```

when one coherent Skill would be better.

Never create:

```text
duplicate Skills
```

with different names.

Never create Skills that only contain:

```text
"Use best practices."
```

Never use Skills as a replacement for proper project documentation.

---

# 19. PROJECT SKILL REGISTRY

Each project should maintain a registry:

```text
PROJECT SKILLS

CORE
├── ...

DOMAIN
├── ...

DATA
├── ...

SECURITY
├── ...

TESTING
├── ...

DEPLOYMENT
└── ...
```

Only relevant Skills should be activated.

---

# 20. SKILL CREATION WORKFLOW

When a new project begins:

```text
PROJECT
↓
IDENTIFY DOMAINS
↓
IDENTIFY COMPLEX REQUIREMENTS
↓
SEARCH EXISTING SKILLS
↓
REUSE EXISTING SKILLS
↓
EXTEND WHEN POSSIBLE
↓
CREATE ONLY MISSING SKILLS
↓
VALIDATE SKILLS
↓
REGISTER SKILLS
↓
CREATE PROJECT RULES
↓
IMPLEMENT
```

---

# 21. AUTOMATIC SKILL TRIGGER

During development, if the agent encounters a recurring specialized requirement that is not covered:

```text
DETECT GAP
↓
CHECK EXISTING SKILLS
↓
DETERMINE REUSABILITY
↓
CREATE / UPDATE SKILL
↓
VALIDATE
↓
REGISTER
↓
CONTINUE
```

Do not stop development unnecessarily for trivial gaps.

---

# 22. PROJECT RULE REGISTRY

Maintain a project-specific registry:

```text
PROJECT RULES

ARCHITECTURE
DATA
API
DATABASE
SECURITY
ERROR HANDLING
TESTING
DEPLOYMENT
DOMAIN
PERFORMANCE
```

Rules must be explicit and discoverable.

---

# 23. FINAL SKILL AUDIT

Before project completion:

Check:

```text
Are required Skills present?
Are duplicate Skills present?
Are outdated Skills present?
Do Skills conflict with Project Rules?
Are important project rules undocumented?
Did implementation reveal a reusable Skill?
```

Update the registry where necessary.

---

# 24. GOLDEN RULE

> SKILLS EXIST TO PRESERVE KNOWLEDGE AND CONSISTENCY, NOT TO CREATE COMPLEXITY.

> REUSE BEFORE CREATE.

> EXTEND BEFORE DUPLICATE.

> CREATE ONLY WHEN THERE IS REAL VALUE.

---

# FINAL SYSTEM

The complete Agent hierarchy is:

```text
GLOBAL RULES
        ↓
PROJECT INITIALIZATION
        ↓
SKILL DISCOVERY
        ↓
SKILL CREATION / UPDATE
        ↓
PROJECT RULES
        ↓
IMPLEMENTATION PLAN
        ↓
IMPLEMENTATION
        ↓
TESTING
        ↓
VERIFICATION
        ↓
SKILL / RULE AUDIT
        ↓
PROJECT COMPLETE
```

The final objective is:

> Every new project starts from a known, controlled, documented, and reusable foundation rather than from assumptions.
