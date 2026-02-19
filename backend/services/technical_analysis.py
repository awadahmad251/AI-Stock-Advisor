"""Technical Analysis calculations — SMA, EMA, RSI, MACD, Bollinger Bands"""
import numpy as np


def compute_sma(closes: list, window: int = 20) -> list:
    """Simple Moving Average"""
    arr = np.array(closes, dtype=float)
    sma = np.full_like(arr, np.nan)
    if len(arr) >= window:
        cumsum = np.cumsum(arr)
        cumsum[window:] = cumsum[window:] - cumsum[:-window]
        sma[window - 1:] = cumsum[window - 1:] / window
    return [None if np.isnan(v) else round(float(v), 2) for v in sma]


def compute_ema(closes: list, span: int = 20) -> list:
    """Exponential Moving Average"""
    arr = np.array(closes, dtype=float)
    ema = np.full_like(arr, np.nan)
    if len(arr) < span:
        return [None] * len(arr)
    k = 2 / (span + 1)
    ema[span - 1] = np.mean(arr[:span])
    for i in range(span, len(arr)):
        ema[i] = arr[i] * k + ema[i - 1] * (1 - k)
    return [None if np.isnan(v) else round(float(v), 2) for v in ema]


def compute_rsi(closes: list, period: int = 14) -> list:
    """Relative Strength Index"""
    arr = np.array(closes, dtype=float)
    rsi = [None] * len(arr)
    if len(arr) <= period:
        return rsi

    deltas = np.diff(arr)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)

    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    for i in range(period, len(arr)):
        if avg_loss == 0:
            rsi[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi[i] = round(100 - (100 / (1 + rs)), 2)

        if i < len(deltas):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    return rsi


def compute_macd(closes: list, fast: int = 12, slow: int = 26, signal: int = 9):
    """MACD — returns (macd_line, signal_line, histogram)"""
    ema_fast = compute_ema(closes, fast)
    ema_slow = compute_ema(closes, slow)

    macd_line = []
    for f, s in zip(ema_fast, ema_slow):
        if f is not None and s is not None:
            macd_line.append(round(f - s, 2))
        else:
            macd_line.append(None)

    # Signal line = EMA of MACD
    valid_macd = [v for v in macd_line if v is not None]
    if len(valid_macd) < signal:
        return macd_line, [None] * len(closes), [None] * len(closes)

    signal_values = compute_ema(valid_macd, signal)

    # Pad signal to match full length
    pad = len(macd_line) - len(valid_macd)
    signal_line = [None] * pad + signal_values

    # Histogram = MACD - Signal
    histogram = []
    for m, s in zip(macd_line, signal_line):
        if m is not None and s is not None:
            histogram.append(round(m - s, 2))
        else:
            histogram.append(None)

    return macd_line, signal_line, histogram


def compute_bollinger(closes: list, window: int = 20, num_std: float = 2.0):
    """Bollinger Bands — returns (upper, middle/SMA, lower)"""
    arr = np.array(closes, dtype=float)
    middle = compute_sma(closes, window)

    upper = [None] * len(arr)
    lower = [None] * len(arr)

    for i in range(window - 1, len(arr)):
        std = float(np.std(arr[i - window + 1:i + 1]))
        if middle[i] is not None:
            upper[i] = round(middle[i] + num_std * std, 2)
            lower[i] = round(middle[i] - num_std * std, 2)

    return upper, middle, lower


def get_all_indicators(history: list):
    """Compute all technical indicators for a price history list"""
    closes = [h["close"] for h in history]

    sma_20 = compute_sma(closes, 20)
    sma_50 = compute_sma(closes, 50)
    ema_12 = compute_ema(closes, 12)
    ema_26 = compute_ema(closes, 26)
    rsi = compute_rsi(closes, 14)
    macd_line, signal_line, histogram = compute_macd(closes)
    bb_upper, bb_middle, bb_lower = compute_bollinger(closes)

    result = []
    for i, h in enumerate(history):
        result.append({
            **h,
            "sma_20": sma_20[i],
            "sma_50": sma_50[i],
            "ema_12": ema_12[i],
            "ema_26": ema_26[i],
            "rsi": rsi[i],
            "macd": macd_line[i],
            "macd_signal": signal_line[i],
            "macd_histogram": histogram[i],
            "bb_upper": bb_upper[i],
            "bb_middle": bb_middle[i],
            "bb_lower": bb_lower[i],
        })
    return result
