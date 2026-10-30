const FEATURE_LABELS = {
  amount_inr: 'Transaction Amount',
  amount_vs_average_ratio: 'Spending Compared to Average',
  amount_change_from_previous_ratio: 'Change from Previous Amount',
  transaction_frequency: 'Transaction Frequency',
  distance_from_previous_location_km: 'Distance from Previous Transaction',
  account_balance_inr: 'Account Balance',
  credit_score: 'Credit Score',
  hour_of_day: 'Transaction Hour',
  day_of_week: 'Day of Week',
  is_weekend: 'Weekend Transaction',
  device_type: 'Device Information',
  network_type: 'Network Connection',
  payment_method: 'Payment Method',
  merchant_category: 'Merchant Category',
  account_type: 'Account Type',
  transaction_type: 'Transaction Type',
  transaction_direction: 'Transaction Direction',
  hour_sin: 'Time-of-Day Pattern',
  hour_cos: 'Time-of-Day Pattern',
  day_sin: 'Day-of-Week Pattern',
  day_cos: 'Day-of-Week Pattern',
  amount_balance_ratio: 'Amount Compared to Balance',
  amount_previous_ratio: 'Amount Compared to Previous Transaction',
  spending_deviation: 'Spending Deviation',
  large_transaction_flag: 'Large Transaction Pattern',
  unusual_hour_flag: 'Unusual Hour Pattern',
  high_frequency_flag: 'High-Frequency Pattern',
  transaction_month: 'Transaction Month',
  transaction_day: 'Transaction Day',
  transaction_hour: 'Transaction Hour',
  transaction_minute: 'Transaction Minute'
}

const CATEGORY_LABELS = {
  account_type: 'Account Type',
  transaction_type: 'Transaction Type',
  merchant_category: 'Merchant Category',
  payment_method: 'Payment Method',
  transaction_direction: 'Transaction Direction',
  location: 'Location',
  device_type: 'Device Information',
  network_type: 'Network Connection'
}

export function getRawFeatureName(feature = '') {
  return feature.includes('__') ? feature.split('__').slice(1).join('__') : feature
}

export function formatFeatureName(feature = '') {
  const raw = getRawFeatureName(feature)
  if (FEATURE_LABELS[raw]) return FEATURE_LABELS[raw]

  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    const prefix = `${key}_`
    if (raw.startsWith(prefix)) {
      return `${label}: ${raw.slice(prefix.length)}`
    }
  }

  return raw || 'Unknown transformed feature'
}

export function formatImpact(impact) {
  const value = Number(impact) || 0
  return `${value >= 0 ? '+' : ''}${value.toFixed(6)}`
}

export function getSignificantShap(data = [], threshold = 0.0005) {
  return data
    .map(item => ({ ...item, impact: Number(item.impact) || 0 }))
    .filter(item => Math.abs(item.impact) >= threshold)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
}
