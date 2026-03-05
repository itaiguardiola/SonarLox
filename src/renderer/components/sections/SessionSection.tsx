import { useAppStore } from '../../stores/useAppStore'
import { useProjectIO } from '../../hooks/useProjectIO'

export function SessionSection() {
  const { saveProject, openProject, newProject } = useProjectIO()
  const projectTitle = useAppStore((s) => s.projectTitle)
  const isDirty = useAppStore((s) => s.isDirty)
  const setProjectTitle = useAppStore((s) => s.setProjectTitle)
  const currentProjectPath = useAppStore((s) => s.currentProjectPath)

  return (
    <div className="project-session">
      <span className="section-label">Session</span>
      <div className="project-title-well">
        <span className={isDirty ? 'project-dirty-led' : 'project-clean-led'}
          title={isDirty ? 'Unsaved changes' : 'Saved'}
        />
        <input
          className="project-title-input"
          type="text"
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          placeholder="Untitled"
          spellCheck={false}
        />
      </div>
      {currentProjectPath && (
        <div className="project-path" title={currentProjectPath}>
          {currentProjectPath.split(/[\\/]/).pop()}
        </div>
      )}
      <div className="project-actions">
        <button className="btn" onClick={newProject} title="New project (Ctrl+N)">New</button>
        <button className="btn" onClick={() => openProject()} title="Open project (Ctrl+O)">Open</button>
        <button className="btn btn--accent" onClick={() => saveProject()} title="Save project (Ctrl+S)">Save</button>
      </div>
      <div className="project-hints">
        <span><span className="project-hint-key">Ctrl+S</span> save</span>
        <span><span className="project-hint-key">Ctrl+O</span> open</span>
      </div>
    </div>
  )
}
