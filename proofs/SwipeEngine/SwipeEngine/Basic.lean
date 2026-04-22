/-
  Swipe engine — formal state machine

  Formalises the state machine of `src/components/mushaf/SwipeReader.tsx` as
  a pure transition system and proves the key safety properties that the
  engine must satisfy. The TypeScript implementation is a faithful
  transliteration of `Engine.step`.

  Assumptions (boundary between the pure model and the real DOM):
    A1. The track's CSS `transform` is a monotone function of `engine.offset`.
        Writing the offset is a side effect; it does not influence subsequent
        transitions modelled here.
    A2. The two ways the SETTLING state can exit — native `transitionend`
        and the `TRANSITION_MS + 40ms` timeout fallback — are collapsed into
        a single nondeterministic `Settle` event. The TS implementation
        guarantees that exactly one of the two fires while SETTLING (the
        other becomes a no-op via the idempotency check).
    A3. External navigation (`ExternalNav n`) arrives as a single atomic
        event from the parent's point of view.
    A4. Touch identifiers are unique within a gesture. The multi-touch
        handoff case is modelled as a second `TouchStart` while DRAGGING.
    A5. Width `W` is constant for the duration of a gesture. The TS resize
        handler fires only in IDLE, preserving this invariant.
-/

namespace SwipeEngine

inductive EState where
  | idle
  | dragging
  | settling
  deriving Repr, DecidableEq

inductive SwipeDecision where
  | unknown
  | horizontal
  | vertical
  deriving Repr, DecidableEq

structure Engine where
  state        : EState
  page         : Nat
  totalPages   : Nat
  width        : Nat
  offset       : Int
  startOffset  : Int
  startX       : Int
  lastX        : Int
  decided      : SwipeDecision
  deriving Repr

inductive Event where
  | touchStart (x : Int)
  | touchMove  (x : Int) (y : Int) (startY : Int)
  | touchEnd
  | settle
  | externalNav (n : Nat)
  deriving Repr

def COMMIT_MIN_PX : Int := 28
def COMMIT_RATIO_NUM : Int := 16
def COMMIT_RATIO_DEN : Int := 100

def iabs (x : Int) : Int := if x < 0 then -x else x

def commitDistance (W : Nat) : Int :=
  let w : Int := W
  let ratio := (w * COMMIT_RATIO_NUM) / COMMIT_RATIO_DEN
  if ratio < COMMIT_MIN_PX then COMMIT_MIN_PX else ratio

def hasDistanceIntent (deltaX : Int) (W : Nat) : Bool :=
  decide (iabs deltaX ≥ commitDistance W)

def anchor (e : Engine) : Engine :=
  { e with state := EState.idle, offset := e.width }

def clampPage (n : Nat) (total : Nat) : Nat :=
  if n < 1 then 1
  else if n > total then total
  else n

def step (e : Engine) : Event → Engine
  | Event.touchStart x =>
    match e.state with
    | EState.idle =>
      { e with
        state := EState.dragging
        startOffset := e.width
        startX := x
        lastX := x
        decided := SwipeDecision.unknown }
    | EState.dragging =>
      let runningDx := e.lastX - e.startX
      { e with
        startX := x - runningDx
        lastX := x }
    | EState.settling =>
      { e with
        state := EState.dragging
        startOffset := e.offset
        startX := x
        lastX := x
        decided := SwipeDecision.horizontal }

  | Event.touchMove x y startY =>
    match e.state with
    | EState.dragging =>
      let deltaX := x - e.startX
      let absX := iabs deltaX
      let absY := iabs (y - startY)
      let decided' :=
        match e.decided with
        | SwipeDecision.unknown =>
          if absX > 5 ∨ absY > 5 then
            if absX * 10 > absY * 13 then SwipeDecision.horizontal
            else SwipeDecision.vertical
          else SwipeDecision.unknown
        | d => d
      match decided' with
      | SwipeDecision.vertical =>
        { e with state := EState.idle, decided := decided' }
      | _ =>
        { e with lastX := x, decided := decided', offset := e.startOffset + deltaX }
    | _ => e

  | Event.touchEnd =>
    match e.state with
    | EState.dragging =>
      if e.decided ≠ SwipeDecision.horizontal then
        { e with state := EState.idle }
      else
        let deltaX := e.lastX - e.startX
        if hasDistanceIntent deltaX e.width then
          let target :=
            if deltaX < 0 ∧ e.page > 1 then e.page - 1
            else if deltaX > 0 ∧ e.page < e.totalPages then e.page + 1
            else e.page
          let offsetTarget : Int :=
            if deltaX < 0 ∧ e.page > 1 then 0
            else if deltaX > 0 ∧ e.page < e.totalPages then 2 * (e.width : Int)
            else (e.width : Int)
          { e with state := EState.settling, offset := offsetTarget, page := target }
        else
          { e with state := EState.settling, offset := e.width }
    | _ => e

  | Event.settle =>
    match e.state with
    | EState.settling => anchor e
    | _ => e

  | Event.externalNav n =>
    let p := clampPage n e.totalPages
    { e with state := EState.idle, page := p, offset := e.width }

def WellFormed (e : Engine) : Prop :=
  1 ≤ e.page ∧ e.page ≤ e.totalPages ∧ 1 ≤ e.totalPages ∧ 1 ≤ e.width

-- ═══════════════════════════════════════════════════════════════════════════
-- Theorems (mechanically checked)
-- ═══════════════════════════════════════════════════════════════════════════

/-- **S3 — No lost input**: `TouchStart` from any state produces DRAGGING. -/
theorem touchstart_always_drags (e : Engine) (x : Int) :
    (step e (Event.touchStart x)).state = EState.dragging := by
  simp [step]
  cases e.state <;> rfl

/-- **S6 — Anchor invariant**: `Settle` from SETTLING lands in IDLE with
    `offset = width`. -/
theorem settle_anchors (e : Engine) (h : e.state = EState.settling) :
    (step e Event.settle).state = EState.idle ∧
    (step e Event.settle).offset = e.width := by
  simp [step, h, anchor]

/-- **S7 — Interrupt correctness**: `TouchStart` during SETTLING moves to
    DRAGGING and inherits the current visual `offset` as `startOffset`. -/
theorem interrupt_inherits
    (e : Engine) (x : Int) (h : e.state = EState.settling) :
    (step e (Event.touchStart x)).state = EState.dragging ∧
    (step e (Event.touchStart x)).startOffset = e.offset ∧
    (step e (Event.touchStart x)).startX = x := by
  simp [step, h]

/-- Decision is `unknown` on TouchStart from IDLE (fresh gesture). -/
theorem touchstart_from_idle_unknown
    (e : Engine) (x : Int) (h : e.state = EState.idle) :
    (step e (Event.touchStart x)).decided = SwipeDecision.unknown := by
  simp [step, h]

/-- Decision is `horizontal` on interrupt (SETTLING → DRAGGING). -/
theorem interrupt_is_horizontal
    (e : Engine) (x : Int) (h : e.state = EState.settling) :
    (step e (Event.touchStart x)).decided = SwipeDecision.horizontal := by
  simp [step, h]

/-- Page is unchanged by TouchStart. -/
theorem page_unchanged_on_touch_start (e : Engine) (x : Int) :
    (step e (Event.touchStart x)).page = e.page := by
  simp [step]; cases e.state <;> rfl

/-- Page is unchanged by TouchMove. -/
theorem page_unchanged_on_touch_move (e : Engine) (x y sy : Int) :
    (step e (Event.touchMove x y sy)).page = e.page := by
  cases hs : e.state
  all_goals simp [step, hs]
  split <;> rfl

/-- Page is unchanged by Settle. -/
theorem page_unchanged_on_settle (e : Engine) :
    (step e Event.settle).page = e.page := by
  simp [step]; cases e.state <;> simp [anchor]

/-- **Trivial gesture reaches IDLE** — TouchStart+TouchEnd with no move. -/
theorem trivial_gesture_ends_idle
    (e : Engine) (hs : e.state = EState.idle) (x : Int) :
    (step (step e (Event.touchStart x)) Event.touchEnd).state = EState.idle := by
  simp [step, hs]

/-- **Horizontal gesture reaches SETTLING on TouchEnd**. -/
theorem horizontal_touchend_enters_settling
    (e : Engine) (hs : e.state = EState.dragging)
    (hh : e.decided = SwipeDecision.horizontal) :
    (step e Event.touchEnd).state = EState.settling := by
  simp [step, hs, hh]
  split <;> rfl

/-- **Settle from SETTLING goes to IDLE**. -/
theorem settle_from_settling_idle
    (e : Engine) (h : e.state = EState.settling) :
    (step e Event.settle).state = EState.idle :=
  (settle_anchors e h).1

/-- **S2a — Commit direction (leftward)**. -/
theorem commit_left_decrements_page
    (e : Engine) (hs : e.state = EState.dragging)
    (hh : e.decided = SwipeDecision.horizontal)
    (hcommit : hasDistanceIntent (e.lastX - e.startX) e.width = true)
    (hneg : e.lastX - e.startX < 0) (hpg : e.page > 1) :
    (step e Event.touchEnd).page = e.page - 1 := by
  simp [step, hs, hh, hcommit, hneg, hpg]

/-- **S2b — Commit direction (rightward)**. -/
theorem commit_right_increments_page
    (e : Engine) (hs : e.state = EState.dragging)
    (hh : e.decided = SwipeDecision.horizontal)
    (hcommit : hasDistanceIntent (e.lastX - e.startX) e.width = true)
    (hpos : e.lastX - e.startX > 0) (hpg : e.page < e.totalPages) :
    (step e Event.touchEnd).page = e.page + 1 := by
  have hnneg : ¬(e.lastX - e.startX < 0) := by omega
  have hposX : e.startX < e.lastX := by omega
  simp [step, hs, hh, hcommit, hnneg, hposX, hpg]

/-- **S2c — No commit below threshold**. -/
theorem no_commit_preserves_page
    (e : Engine) (hs : e.state = EState.dragging)
    (hh : e.decided = SwipeDecision.horizontal)
    (hcommit : hasDistanceIntent (e.lastX - e.startX) e.width = false) :
    (step e Event.touchEnd).page = e.page := by
  simp [step, hs, hh, hcommit]

-- ═══════════════════════════════════════════════════════════════════════════
-- Spec checklist — statements without detailed proofs.
-- These capture the remaining invariants the TS engine must preserve. They
-- are mechanically type-checked but proofs are deferred (`sorry`); each
-- would be a case analysis on all branches of `step`.
-- ═══════════════════════════════════════════════════════════════════════════

/-- **S4 — No double-commit**: `TouchEnd` changes the page by at most ±1. -/
theorem touchend_changes_page_by_at_most_one (e : Engine) :
    (step e Event.touchEnd).page = e.page ∨
    (step e Event.touchEnd).page + 1 = e.page ∨
    (step e Event.touchEnd).page = e.page + 1 := by
  sorry

/-- **S5 — Page-in-range invariant**: every transition preserves
    `1 ≤ page ≤ totalPages` when the input is well-formed. -/
theorem page_in_range (e : Engine) (ev : Event) (h : WellFormed e) :
    1 ≤ (step e ev).page ∧ (step e ev).page ≤ e.totalPages := by
  sorry

/-- **Boundary — cannot commit before page 1**. -/
theorem boundary_leftward_at_page1
    (e : Engine) (hs : e.state = EState.dragging)
    (hh : e.decided = SwipeDecision.horizontal)
    (hcommit : hasDistanceIntent (e.lastX - e.startX) e.width = true)
    (hneg : e.lastX - e.startX < 0) (hpg : e.page = 1) :
    (step e Event.touchEnd).page ≤ 1 := by
  sorry

/-- **Boundary — cannot commit past totalPages**. -/
theorem boundary_rightward_at_end
    (e : Engine) (hs : e.state = EState.dragging)
    (hh : e.decided = SwipeDecision.horizontal)
    (hcommit : hasDistanceIntent (e.lastX - e.startX) e.width = true)
    (hpos : e.lastX - e.startX > 0) (hpg : e.page = e.totalPages) :
    (step e Event.touchEnd).page ≤ e.totalPages := by
  sorry

end SwipeEngine
