import { useState, useCallback, type ReactNode } from 'react'

interface SectionProps {
  label: string
  /** Right-aligned accessory next to the label (badge, button, etc.) */
  accessory?: ReactNode
  /** Start collapsed */
  defaultCollapsed?: boolean
  children: ReactNode
}

export function Section({ label, accessory, defaultCollapsed = false, children }: SectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const toggle = useCallback(() => setCollapsed((c) => !c), [])

  return (
    <div className="cp-section">
      <button className="cp-section-header" onClick={toggle} type="button">
        <span className={`cp-section-chevron ${collapsed ? '' : 'cp-section-chevron--open'}`} />
        <span className="cp-section-label">{label}</span>
        {accessory && (
          <span className="cp-section-accessory" onClick={(e) => e.stopPropagation()}>
            {accessory}
          </span>
        )}
      </button>
      {!collapsed && <div className="cp-section-body">{children}</div>}
    </div>
  )
}
