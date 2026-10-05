// Figma IDs identify presentations, not navigation destinations.
export const frames = {
  home: { available: '4:42962', unavailable: '4:42997' },
  notification: { unselected: '4:43036', sms: '4:43068', orderNumber: '4:43100' },
  phone: { valid: '4:43132', invalid: '4:43187' },
  consent: { unchecked: '4:43243', checked: '4:43279' },
  review: { sms: '4:43316', orderNumber: '4:43362', submitting: '4:43405' },
  result: { sms: '4:43452', orderNumber: '4:43480' },
} as const
