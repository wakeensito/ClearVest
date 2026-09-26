"""Plain-language portfolio risk score, computed in code (never by the model).

score = 0.7 * asset-mix risk + 0.3 * single-name concentration, then shifted for
the person's horizon and age: the same portfolio is riskier for a 63-year-old
retiring soon than for a 22-year-old with 40 years to recover.
"""

TYPE_RISK = {
    "cash": 0.0, "fixed income": 0.25, "etf": 0.6, "mutual fund": 0.6, "other": 0.6,
    "equity": 0.8, "cryptocurrency": 1.0, "derivative": 1.0,
}
SINGLE_NAME = {"equity", "cryptocurrency", "derivative"}


def _label(value: int) -> str:
    if value <= 33:
        return "Conservative"
    return "Moderate" if value <= 66 else "Aggressive"


def score(holdings: list[dict], profile: dict | None) -> dict:
    invested = [h for h in holdings if h.get("weight", 0) != 0]
    if not invested:
        return {
            "score": 0, "label": "Conservative",
            "factors": [{"name": "No invested assets", "detail": "There is nothing invested to score yet."}],
            "summary": "No invested assets yet.",
        }

    def type_risk(h: dict) -> float:
        # Short/margin positions (negative weight) can lose more than 100%, so they
        # carry the max type risk regardless of the reported instrument type.
        return 1.0 if h["weight"] < 0 else TYPE_RISK.get(h.get("type", "other"), 0.6)

    mix = 100 * sum(abs(h["weight"]) * type_risk(h) for h in invested)
    singles = [h for h in invested if h.get("type") in SINGLE_NAME or h["weight"] < 0]
    concentration = 100 * sum(h["weight"] ** 2 for h in singles)
    base = 0.7 * mix + 0.3 * concentration
    factors = [
        {"name": "Asset mix", "detail": f"Your holdings' types carry a mix risk of {mix:.0f}/100 "
                                        "(cash 0, bonds 25, funds 60, single stocks 80, crypto 100)."},
    ]
    if singles:
        top = max(singles, key=lambda h: abs(h["weight"]))
        factors.append({"name": "Concentration", "detail": f"Your largest single position is "
                                                           f"{top.get('symbol', 'one position')} "
                                                           f"at {abs(top['weight']):.0%} of the portfolio."})
    else:
        factors.append({"name": "Concentration", "detail": "No single stock or coin: your risk is spread across funds."})

    if any(h["weight"] < 0 for h in invested):
        factors.append({"name": "Borrowed or short positions",
                         "detail": "Some positions are short or bought on margin, which can lose more than you put in."})

    adjust = 0
    if profile:
        horizon, age = profile.get("horizon"), profile.get("age")
        if horizon == "short":
            adjust += 10
            factors.append({"name": "Time horizon", "detail": "You need this money soon, so drops hurt more."})
        elif horizon == "long":
            adjust -= 5
            factors.append({"name": "Time horizon", "detail": "A long horizon gives you time to recover from drops."})
        if isinstance(age, int) and age >= 60:
            adjust += 10
            factors.append({"name": "Age", "detail": "Near retirement there is less time to recover from a loss."})
        elif isinstance(age, int) and age < 30:
            adjust -= 5
            factors.append({"name": "Age", "detail": "Starting young means decades of compounding ahead."})
    else:
        factors.append({"name": "Profile", "detail": "Add your age and horizon for a personalized score."})

    value = round(min(100, max(0, base + adjust)))
    label = _label(value)
    return {"score": value, "label": label, "factors": factors, "summary": f"{label} risk: {value}/100."}
