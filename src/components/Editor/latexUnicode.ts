// Julia LaTeX → Unicode completions (triggered by Tab after a \sequence)
// Based on Julia's latex_symbols table
export const LATEX_UNICODE: Record<string, string> = {
  // Greek lowercase
  "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
  "\\epsilon": "ε", "\\varepsilon": "ε", "\\zeta": "ζ", "\\eta": "η",
  "\\theta": "θ", "\\vartheta": "ϑ", "\\iota": "ι", "\\kappa": "κ",
  "\\lambda": "λ", "\\mu": "μ", "\\nu": "ν", "\\xi": "ξ",
  "\\pi": "π", "\\varpi": "ϖ", "\\rho": "ρ", "\\varrho": "ϱ",
  "\\sigma": "σ", "\\varsigma": "ς", "\\tau": "τ", "\\upsilon": "υ",
  "\\phi": "ϕ", "\\varphi": "φ", "\\chi": "χ", "\\psi": "ψ", "\\omega": "ω",

  // Greek uppercase
  "\\Alpha": "Α", "\\Beta": "Β", "\\Gamma": "Γ", "\\Delta": "Δ",
  "\\Epsilon": "Ε", "\\Zeta": "Ζ", "\\Eta": "Η", "\\Theta": "Θ",
  "\\Iota": "Ι", "\\Kappa": "Κ", "\\Lambda": "Λ", "\\Mu": "Μ",
  "\\Nu": "Ν", "\\Xi": "Ξ", "\\Pi": "Π", "\\Rho": "Ρ",
  "\\Sigma": "Σ", "\\Tau": "Τ", "\\Upsilon": "Υ", "\\Phi": "Φ",
  "\\Chi": "Χ", "\\Psi": "Ψ", "\\Omega": "Ω",

  // Math operators
  "\\pm": "±", "\\mp": "∓", "\\times": "×", "\\div": "÷",
  "\\cdot": "⋅", "\\circ": "∘", "\\bullet": "•", "\\star": "⋆",
  "\\ast": "∗", "\\oplus": "⊕", "\\ominus": "⊖", "\\otimes": "⊗",
  "\\oslash": "⊘", "\\odot": "⊙", "\\wedge": "∧", "\\vee": "∨",
  "\\cap": "∩", "\\cup": "∪", "\\sqcap": "⊓", "\\sqcup": "⊔",
  "\\uplus": "⊎", "\\setminus": "∖", "\\smallsetminus": "∖",

  // Relations
  "\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥",
  "\\neq": "≠", "\\ne": "≠", "\\approx": "≈", "\\equiv": "≡",
  "\\sim": "∼", "\\simeq": "≃", "\\cong": "≅", "\\propto": "∝",
  "\\subset": "⊂", "\\supset": "⊃", "\\subseteq": "⊆", "\\supseteq": "⊇",
  "\\sqsubset": "⊏", "\\sqsupset": "⊐", "\\sqsubseteq": "⊑", "\\sqsupseteq": "⊒",
  "\\in": "∈", "\\notin": "∉", "\\ni": "∋", "\\prec": "≺", "\\succ": "≻",
  "\\preceq": "≼", "\\succeq": "≽", "\\perp": "⊥", "\\parallel": "∥",
  "\\ll": "≪", "\\gg": "≫", "\\lll": "⋘", "\\ggg": "⋙",
  "\\lesssim": "≲", "\\gtrsim": "≳", "\\lessapprox": "⪅", "\\gtrapprox": "⪆",

  // Arrows
  "\\to": "→", "\\rightarrow": "→", "\\leftarrow": "←", "\\gets": "←",
  "\\Rightarrow": "⇒", "\\Leftarrow": "⇐", "\\Leftrightarrow": "⇔",
  "\\leftrightarrow": "↔", "\\longrightarrow": "⟶", "\\longleftarrow": "⟵",
  "\\Longrightarrow": "⟹", "\\Longleftarrow": "⟸", "\\Longleftrightarrow": "⟺",
  "\\uparrow": "↑", "\\downarrow": "↓", "\\Uparrow": "⇑", "\\Downarrow": "⇓",
  "\\updownarrow": "↕", "\\Updownarrow": "⇕", "\\nearrow": "↗", "\\searrow": "↘",
  "\\nwarrow": "↖", "\\swarrow": "↙", "\\mapsto": "↦", "\\hookrightarrow": "↪",
  "\\hookleftarrow": "↩", "\\rightharpoonup": "⇀", "\\leftharpoonup": "↼",

  // Logic & Set
  "\\forall": "∀", "\\exists": "∃", "\\nexists": "∄", "\\neg": "¬",
  "\\emptyset": "∅", "\\varnothing": "∅", "\\infty": "∞",
  "\\partial": "∂", "\\nabla": "∇", "\\therefore": "∴", "\\because": "∵",

  // Calculus / Analysis
  "\\int": "∫", "\\iint": "∬", "\\iiint": "∭", "\\oint": "∮",
  "\\sum": "∑", "\\prod": "∏", "\\coprod": "∐", "\\sqrt": "√",

  // Miscellaneous math
  "\\aleph": "ℵ", "\\beth": "ℶ", "\\gimel": "ℷ",
  "\\hbar": "ℏ", "\\ell": "ℓ", "\\Re": "ℜ", "\\Im": "ℑ",
  "\\wp": "℘", "\\complement": "∁", "\\angle": "∠", "\\measuredangle": "∡",
  "\\sphericalangle": "∢", "\\top": "⊤", "\\bot": "⊥",
  "\\vdots": "⋮", "\\ddots": "⋱", "\\cdots": "⋯", "\\ldots": "…",
  "\\langle": "⟨", "\\rangle": "⟩",
  "\\lceil": "⌈", "\\rceil": "⌉", "\\lfloor": "⌊", "\\rfloor": "⌋",

  // Blackboard bold (double-struck)
  "\\mathbb{N}": "ℕ", "\\mathbb{Z}": "ℤ", "\\mathbb{Q}": "ℚ",
  "\\mathbb{R}": "ℝ", "\\mathbb{C}": "ℂ", "\\mathbb{P}": "ℙ",
  "\\BbbN": "ℕ", "\\BbbZ": "ℤ", "\\BbbQ": "ℚ", "\\BbbR": "ℝ", "\\BbbC": "ℂ",

  // Subscript digits
  "\\^0": "⁰", "\\^1": "¹", "\\^2": "²", "\\^3": "³", "\\^4": "⁴",
  "\\^5": "⁵", "\\^6": "⁶", "\\^7": "⁷", "\\^8": "⁸", "\\^9": "⁹",
  "\\_0": "₀", "\\_1": "₁", "\\_2": "₂", "\\_3": "₃", "\\_4": "₄",
  "\\_5": "₅", "\\_6": "₆", "\\_7": "₇", "\\_8": "₈", "\\_9": "₉",

  // Superscript letters
  "\\^a": "ᵃ", "\\^b": "ᵇ", "\\^c": "ᶜ", "\\^d": "ᵈ", "\\^e": "ᵉ",
  "\\^f": "ᶠ", "\\^g": "ᵍ", "\\^h": "ʰ", "\\^i": "ⁱ", "\\^j": "ʲ",
  "\\^k": "ᵏ", "\\^l": "ˡ", "\\^m": "ᵐ", "\\^n": "ⁿ", "\\^o": "ᵒ",
  "\\^p": "ᵖ", "\\^r": "ʳ", "\\^s": "ˢ", "\\^t": "ᵗ", "\\^u": "ᵘ",
  "\\^v": "ᵛ", "\\^w": "ʷ", "\\^x": "ˣ", "\\^y": "ʸ", "\\^z": "ᶻ",

  // Subscript letters
  "\\_a": "ₐ", "\\_e": "ₑ", "\\_i": "ᵢ", "\\_o": "ₒ", "\\_u": "ᵤ",
  "\\_r": "ᵣ", "\\_v": "ᵥ", "\\_x": "ₓ",

  // Dots & accents (used as operators)
  "\\hat": "̂", "\\bar": "̄", "\\tilde": "̃", "\\vec": "⃗",
  "\\dot": "̇", "\\ddot": "̈",

  // Emoji / misc commonly used in Julia
  "\\checkmark": "✓", "\\cross": "✗", "\\dag": "†", "\\ddag": "‡",
  "\\S": "§", "\\P": "¶", "\\copyright": "©", "\\registered": "®",
  "\\trademark": "™", "\\degree": "°", "\\prime": "′", "\\dprime": "″",

  // Combining / special
  "\\not": "̸",
};
