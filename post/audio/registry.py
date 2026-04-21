"""Flat mapping from id → spoken-English pronunciation.

Each id generates one mp3 at public/audio/<id>.mp3 via build.py. The id is
passed into Svelte either as a `\\htmlClass{sym-<id>}{...}` wrapper (inside
FormulaWithFocus — click a symbol inside the big objective) or as
`<Math speak="<id>" ... />` (Math component — click the whole expression).
"""

REGISTRY = {
    # ── The big GRPO objective, per-symbol ────────────────────────────────
    "j":                  "J GRPO of theta",
    "expectation":        "expectation over q, and the group o sub i from i equals 1 to G, sampled from pi old of q",
    "group":              "one over G, sum from i equals one to G",
    "pertoken":           "one over the length of o sub i, sum from t equals one to the length of o sub i",
    "min":                "minimum",
    "ratio":              "rho sub i t",
    "advantage":          "A hat sub i",
    "clip":               "clip of rho sub i t, one minus epsilon, one plus epsilon",
    "kl":                 "beta times K L divergence of pi theta from pi reference",

    # ── Bare symbols used across sections ─────────────────────────────────
    "theta":              "theta",
    "epsilon":            "epsilon",
    "beta":               "beta",
    "q":                  "q",
    "G":                  "capital G",
    "o-i":                "o sub i",
    "pi-theta":           "pi theta",
    "pi-old":             "pi old",
    "pi-ref":             "pi reference",
    "R-func":             "R of q comma o",
    "one-plus-eps":       "one plus epsilon",
    "a-t":                "a sub t",
    "s-t":                "s sub t",
    "tau":                "tau",

    # ── Small inline expressions ──────────────────────────────────────────
    "epsilon-approx":     "epsilon equals zero point two",
    "eps-bounds":         "the interval from zero point eight to one point two",
    "delta-logratio":     "delta equals log pi reference, minus log pi theta",
    "k3-estimator":       "delta sub t equals log pi reference of a sub t, minus log pi theta of a sub t. K L sub t equals e to the delta sub t, minus delta sub t, minus one.",
    "R-eq-1":             "R equals one",
    "R-eq-0":             "R equals zero",

    # ── Display formulas (whole-expression pronunciations) ────────────────
    "sampling-dist":      "the set of o sub i from i equals 1 to G, sampled from pi old of q",
    "reward-formula":     "r sub i equals R of q comma o sub i",
    "advantage-formula":  "A hat sub i equals r sub i minus the mean of r one through r G, over the standard deviation of r one through r G, plus epsilon",
    "ratio-formula":      "rho sub i t equals pi theta of o sub i t given q and o sub i less than t, over pi old of o sub i t given q and o sub i less than t",
    "pessimistic-min":    "minimum of rho sub i t times A hat sub i, and clip of rho sub i t, one minus epsilon, one plus epsilon, times A hat sub i",
    "kl-penalty":         "minus beta times K L divergence of pi theta from pi reference",
}
