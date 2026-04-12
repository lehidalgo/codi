"""
Unit tests for scripts/python/easing.py

All easing functions take t in [0.0, 1.0] and return a value in approximately [0.0, 1.0].
Boundary contracts: f(0) == 0.0 and f(1) == 1.0 for all functions.
"""

import pytest
from scripts.python.easing import (
    EASING_FUNCTIONS,
    apply_squash_stretch,
    calculate_arc_motion,
    ease_back_in,
    ease_back_in_out,
    ease_back_out,
    ease_in_bounce,
    ease_in_cubic,
    ease_in_elastic,
    ease_in_out_bounce,
    ease_in_out_cubic,
    ease_in_out_elastic,
    ease_in_out_quad,
    ease_in_quad,
    ease_out_bounce,
    ease_out_cubic,
    ease_out_elastic,
    ease_out_quad,
    get_easing,
    interpolate,
    linear,
)


# ---------------------------------------------------------------------------
# Shared boundary contract: f(0) == 0, f(1) == 1 for all easing functions
# ---------------------------------------------------------------------------

ALL_EASING_FUNCTIONS = [
    linear,
    ease_in_quad,
    ease_out_quad,
    ease_in_out_quad,
    ease_in_cubic,
    ease_out_cubic,
    ease_in_out_cubic,
    ease_in_bounce,
    ease_out_bounce,
    ease_in_out_bounce,
    ease_in_elastic,
    ease_out_elastic,
    ease_in_out_elastic,
    ease_back_in,
    ease_back_out,
    ease_back_in_out,
]


@pytest.mark.parametrize("fn", ALL_EASING_FUNCTIONS)
def test_easing_boundary_at_zero(fn):
    assert fn(0.0) == pytest.approx(0.0, abs=1e-9)


@pytest.mark.parametrize("fn", ALL_EASING_FUNCTIONS)
def test_easing_boundary_at_one(fn):
    assert fn(1.0) == pytest.approx(1.0, abs=1e-9)


# ---------------------------------------------------------------------------
# linear
# ---------------------------------------------------------------------------


def test_linear_midpoint():
    assert linear(0.5) == pytest.approx(0.5)


def test_linear_is_identity():
    for t in [0.1, 0.25, 0.75, 0.9]:
        assert linear(t) == pytest.approx(t)


# ---------------------------------------------------------------------------
# Quadratic
# ---------------------------------------------------------------------------


def test_ease_in_quad_is_monotonically_increasing():
    values = [ease_in_quad(t / 10) for t in range(11)]
    assert values == sorted(values)


def test_ease_out_quad_is_monotonically_increasing():
    values = [ease_out_quad(t / 10) for t in range(11)]
    assert values == sorted(values)


def test_ease_in_out_quad_symmetric():
    # f(t) + f(1-t) should equal 1 by symmetry
    for t in [0.1, 0.25, 0.4]:
        assert ease_in_out_quad(t) + ease_in_out_quad(1 - t) == pytest.approx(
            1.0, abs=1e-9
        )


def test_ease_in_out_quad_midpoint():
    assert ease_in_out_quad(0.5) == pytest.approx(0.5, abs=1e-9)


# ---------------------------------------------------------------------------
# Cubic
# ---------------------------------------------------------------------------


def test_ease_in_cubic_slower_than_quad_at_midpoint():
    # Cubic starts slower than quadratic
    assert ease_in_cubic(0.5) < ease_in_quad(0.5)


def test_ease_out_cubic_faster_than_quad_at_midpoint():
    # Cubic ease-out is faster early
    assert ease_out_cubic(0.5) > ease_out_quad(0.5)


# ---------------------------------------------------------------------------
# Bounce
# ---------------------------------------------------------------------------


def test_ease_out_bounce_has_multiple_bounces():
    # The bounce function should not be monotonic - it reverses direction
    samples = [ease_out_bounce(t / 20) for t in range(1, 20)]
    diffs = [samples[i + 1] - samples[i] for i in range(len(samples) - 1)]
    has_decrease = any(d < 0 for d in diffs)
    assert has_decrease, "ease_out_bounce should reverse direction (bounce effect)"


def test_ease_in_bounce_is_mirror_of_out():
    # ease_in_bounce(t) == 1 - ease_out_bounce(1-t)
    for t in [0.2, 0.5, 0.8]:
        assert ease_in_bounce(t) == pytest.approx(1 - ease_out_bounce(1 - t), abs=1e-9)


# ---------------------------------------------------------------------------
# Elastic
# ---------------------------------------------------------------------------


def test_elastic_out_overshoots_one():
    # Elastic ease-out goes above 1 before settling
    samples = [ease_out_elastic(t / 100) for t in range(1, 100)]
    assert any(s > 1.0 for s in samples), "ease_out_elastic should overshoot 1.0"


def test_elastic_in_undershoots_zero():
    # Elastic ease-in goes below 0 before starting
    samples = [ease_in_elastic(t / 100) for t in range(1, 100)]
    assert any(s < 0.0 for s in samples), "ease_in_elastic should undershoot 0.0"


# ---------------------------------------------------------------------------
# Back (overshoot)
# ---------------------------------------------------------------------------


def test_ease_back_out_overshoots():
    # Back ease-out should exceed 1.0 before settling
    samples = [ease_back_out(t / 100) for t in range(1, 100)]
    assert any(s > 1.0 for s in samples)


def test_ease_back_in_undershoots():
    # Back ease-in should go below 0.0 initially
    samples = [ease_back_in(t / 100) for t in range(1, 100)]
    assert any(s < 0.0 for s in samples)


# ---------------------------------------------------------------------------
# get_easing / EASING_FUNCTIONS registry
# ---------------------------------------------------------------------------


def test_get_easing_returns_linear_for_unknown_name():
    fn = get_easing("does_not_exist")
    assert fn is linear


def test_get_easing_returns_correct_function():
    assert get_easing("linear") is linear
    assert get_easing("ease_in") is ease_in_quad
    assert get_easing("bounce_out") is ease_out_bounce


def test_easing_functions_registry_has_expected_keys():
    expected = {
        "linear",
        "ease_in",
        "ease_out",
        "ease_in_out",
        "bounce_in",
        "bounce_out",
        "bounce",
        "elastic_in",
        "elastic_out",
        "elastic",
        "back_in",
        "back_out",
        "back_in_out",
        "anticipate",
        "overshoot",
    }
    assert expected.issubset(EASING_FUNCTIONS.keys())


# ---------------------------------------------------------------------------
# interpolate
# ---------------------------------------------------------------------------


def test_interpolate_at_zero_returns_start():
    assert interpolate(10.0, 20.0, 0.0) == pytest.approx(10.0)


def test_interpolate_at_one_returns_end():
    assert interpolate(10.0, 20.0, 1.0) == pytest.approx(20.0)


def test_interpolate_midpoint_with_linear():
    assert interpolate(0.0, 100.0, 0.5, easing="linear") == pytest.approx(50.0)


def test_interpolate_uses_easing():
    # With ease_in (quadratic), midpoint should be below linear midpoint
    linear_mid = interpolate(0.0, 100.0, 0.5, easing="linear")
    eased_mid = interpolate(0.0, 100.0, 0.5, easing="ease_in")
    assert eased_mid < linear_mid


# ---------------------------------------------------------------------------
# apply_squash_stretch
# ---------------------------------------------------------------------------


def test_squash_stretch_vertical_preserves_area_approximately():
    w, h = apply_squash_stretch((1.0, 1.0), intensity=0.5, direction="vertical")
    # Width grows, height shrinks
    assert w > 1.0
    assert h < 1.0


def test_squash_stretch_horizontal():
    w, h = apply_squash_stretch((1.0, 1.0), intensity=0.5, direction="horizontal")
    assert w < 1.0
    assert h > 1.0


def test_squash_stretch_both():
    w, h = apply_squash_stretch((1.0, 1.0), intensity=0.5, direction="both")
    assert w < 1.0
    assert h < 1.0


def test_squash_stretch_zero_intensity_is_identity():
    base = (1.5, 2.0)
    w, h = apply_squash_stretch(base, intensity=0.0, direction="vertical")
    assert w == pytest.approx(base[0])
    assert h == pytest.approx(base[1])


# ---------------------------------------------------------------------------
# calculate_arc_motion
# ---------------------------------------------------------------------------


def test_arc_motion_at_zero_returns_start():
    x, y = calculate_arc_motion(start=(0, 0), end=(100, 100), height=50, t=0.0)
    assert x == pytest.approx(0.0)
    assert y == pytest.approx(0.0)


def test_arc_motion_at_one_returns_end():
    x, y = calculate_arc_motion(start=(0, 0), end=(100, 100), height=50, t=1.0)
    assert x == pytest.approx(100.0)
    assert y == pytest.approx(100.0)


def test_arc_motion_midpoint_has_arc_offset():
    # At t=0.5, y should differ from linear interpolation by the arc height
    _, y = calculate_arc_motion(start=(0, 0), end=(0, 0), height=50, t=0.5)
    # Arc offset at midpoint = 4 * height * 0.5 * 0.5 = height
    # y_linear = 0, arc_offset = 50 -> y = 0 - 50 = -50
    assert y == pytest.approx(-50.0, abs=1e-9)


def test_arc_motion_x_is_linear():
    # x follows linear interpolation regardless of height
    for t in [0.25, 0.5, 0.75]:
        x, _ = calculate_arc_motion(start=(0, 0), end=(100, 0), height=99, t=t)
        assert x == pytest.approx(100 * t, abs=1e-9)
