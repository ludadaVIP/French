import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Volume2,
} from "lucide-react";

const DEFAULT_LESSON_ID = "alphabet";

const TYPE_LABELS = {
  letter: "字母",
  rule: "规则",
  chunk: "音块",
  category: "分类",
  word: "单词",
  verb: "动词",
  phrase: "短语",
  sentence: "句子",
  pattern: "句型",
};

function apiGet(path) {
  return fetch(path).then((response) => {
    if (!response.ok) {
      throw new Error(`Request failed: ${path}`);
    }
    return response.json();
  });
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function countExamples(blocks) {
  return blocks.reduce((total, block) => {
    const examples = block.examples || (block.example ? [block.example] : []);
    return total + examples.length;
  }, 0);
}

function getSectionAnchorId(sectionId) {
  return `lesson-section-${sectionId}`;
}

function AudioButton({ active, label = "播放法语发音", loading, onClick }) {
  return (
    <button
      className={`icon-button audio-button ${active ? "is-speaking" : ""}`}
      disabled={loading}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {loading ? (
        <Loader2 className="spin" size={18} strokeWidth={2.2} />
      ) : (
        <Volume2 size={18} strokeWidth={2.2} />
      )}
    </button>
  );
}

function conjugationAudioText(pronoun, form) {
  if (pronoun === "je") {
    const needsElision = /^[aeiouhàâäéèêëîïôöùûü]/i.test(form);
    return needsElision ? `J'${form}` : `Je ${form}`;
  }
  if (pronoun === "il / elle") {
    return `Il ${form}. Elle ${form}.`;
  }
  if (pronoun === "ils / elles") {
    return `Ils ${form}. Elles ${form}.`;
  }
  return `${pronoun} ${form}`;
}

function ConjugationTable({
  blockId,
  conjugation,
  loadingAudioKey,
  onSpeak,
  speakingKey,
}) {
  if (!conjugation) {
    return null;
  }

  const rows = [
    ["je", conjugation.je],
    ["tu", conjugation.tu],
    ["il / elle", conjugation.il],
    ["nous", conjugation.nous],
    ["vous", conjugation.vous],
    ["ils / elles", conjugation.ils],
  ].filter(([, form]) => Boolean(form));

  return (
    <div className="conjugation-table" aria-label="现在时变位">
      <div className="conjugation-title">现在时</div>
      <div className="conjugation-grid">
        {rows.map(([pronoun, form]) => (
          <div className="conjugation-cell" key={pronoun}>
            <div>
              <span>{pronoun}</span>
              <strong>{form}</strong>
            </div>
            <AudioButton
              active={speakingKey === `${blockId}:conjugation:${pronoun}`}
              label="播放变位发音"
              loading={loadingAudioKey === `${blockId}:conjugation:${pronoun}`}
              onClick={() =>
                onSpeak(
                  conjugationAudioText(pronoun, form),
                  `${blockId}:conjugation:${pronoun}`,
                )
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonBlock({ block, heard, loadingAudioKey, onSpeak, speakingKey }) {
  const isSentence = block.type === "sentence" || block.type === "pattern";
  const isLetter = block.type === "letter";
  const displayText = block.text || block.pattern;
  const audioText = block.audioText || displayText;
  const examples = block.examples || (block.example ? [block.example] : []);
  const textClass = isLetter ? "letter-text" : isSentence ? "sentence-text" : "pattern-text";

  return (
    <article className={`learning-card ${heard ? "heard" : ""}`}>
      <div className="card-topline">
        <span className="block-type">{TYPE_LABELS[block.type] || "内容"}</span>
        {heard && <span className="status-pill">已听</span>}
      </div>

      <div className={isSentence ? "sentence-row" : "letter-row"}>
        <div>
          <div className={textClass}>{displayText}</div>
          {block.ipa && <div className="ipa">{block.ipa}</div>}
        </div>
        <AudioButton
          active={speakingKey === block.id}
          loading={loadingAudioKey === block.id}
          onClick={() => onSpeak(audioText, block.id)}
        />
      </div>

      {block.translation && <p className="translation">{block.translation}</p>}
      {block.rule && <p className="rule-text">{block.rule}</p>}
      {block.hint && <p className="hint">{block.hint}</p>}
      <ConjugationTable
        blockId={block.id}
        conjugation={block.conjugation}
        loadingAudioKey={loadingAudioKey}
        onSpeak={onSpeak}
        speakingKey={speakingKey}
      />

      {examples.length > 0 && (
        <div className="example-list">
          {examples.map((example, index) => {
            const exampleKey = `${block.id}:example:${index}`;
            return (
              <div className="example-line" key={exampleKey}>
                <span>{example.text}</span>
                <AudioButton
                  active={speakingKey === exampleKey}
                  loading={loadingAudioKey === exampleKey}
                  label="播放例子发音"
                  onClick={() => onSpeak(example.audioText || example.text, exampleKey)}
                />
                <small>
                  {example.ipa && <span className="example-ipa">{example.ipa}</span>}
                  {example.translation}
                </small>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function Sidebar({
  activeLessonId,
  isOpen,
  onSelectLesson,
  onToggle,
  roadmap,
  visitedLessonIds,
}) {
  return (
    <aside className={`sidebar ${isOpen ? "open" : "collapsed"}`}>
      <div className="sidebar-top">
        <div className="brand">
          <div className="brand-mark">FR</div>
          {isOpen && (
            <div>
              <div className="brand-title">French Sprint</div>
            </div>
          )}
        </div>
        <button
          className="panel-icon-button dark"
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "收起左侧路线" : "展开左侧路线"}
          title={isOpen ? "收起路线" : "展开路线"}
        >
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      {isOpen ? (
        <nav className="roadmap" aria-label="学习路线">
          {roadmap?.phases?.map((phase) => (
            <section className="phase" key={phase.id}>
              <h2>{phase.title}</h2>
              <p>{phase.description}</p>
              <div className="lesson-list">
                {phase.lessons.map((lesson) => {
                  const active = lesson.id === activeLessonId;
                  const visited = visitedLessonIds.includes(lesson.id);
                  return (
                    <button
                      className={`lesson-nav-item ${active ? "active" : ""} ${
                        visited ? "visited" : ""
                      }`}
                      key={lesson.id}
                      type="button"
                      onClick={() => onSelectLesson(lesson.id)}
                      title={lesson.goal}
                    >
                      <span>{lesson.title}</span>
                      <ChevronRight size={15} />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      ) : (
        <div className="side-rail-label">路线</div>
      )}
    </aside>
  );
}

function LessonNavigator({
  activeSectionId,
  onJumpToSection,
  onJumpToTop,
  sections,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const visibleBlocks = sections.reduce(
    (total, section) => total + section.blocks.length,
    0,
  );
  const visibleExamples = sections.reduce(
    (total, section) => total + countExamples(section.blocks),
    0,
  );
  const activeSection = sections.find((section) => section.id === activeSectionId);

  const jumpToSection = (sectionId) => {
    onJumpToSection(sectionId);
    setIsExpanded(false);
  };

  return (
    <section
      className={`lesson-control-panel ${isExpanded ? "expanded" : "collapsed"}`}
      aria-label="本课导航"
    >
      <div className="lesson-map">
        <div className="lesson-map-heading">
          <div>
            <div className="map-label">本课目录</div>
            <div className="map-summary">
              {isExpanded
                ? `${sections.length} 个模块 · ${visibleBlocks} 个内容块 · ${visibleExamples} 组例子`
                : activeSection?.title || `${sections.length} 个模块`}
            </div>
          </div>
          <div className="map-actions">
            <button className="mini-button" type="button" onClick={onJumpToTop}>
              顶部
            </button>
            <button
              className="mini-button"
              type="button"
              onClick={() => setIsExpanded((value) => !value)}
            >
              {isExpanded ? "收起" : "展开"}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="section-jump-list">
            {sections.map((section, index) => (
              <button
                className={`section-jump-button ${
                  activeSectionId === section.id ? "active" : ""
                }`}
                key={section.id}
                type="button"
                onClick={() => jumpToSection(section.id)}
                title={section.note}
              >
                <span>{index + 1}. {section.title}</span>
                <small>{section.blocks.length}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RightPanel({
  activeSectionId,
  audioError,
  isOpen,
  lesson,
  lessonSections,
  nextLesson,
  onJumpToSection,
  onJumpToTop,
  onSelectLesson,
  onToggle,
  previousLesson,
}) {
  if (!isOpen) {
    return (
      <aside className="right-panel collapsed" aria-label="本课工具栏">
        <button
          className="panel-icon-button"
          type="button"
          onClick={onToggle}
          aria-label="展开右侧学习面板"
          title="展开学习面板"
        >
          <PanelRightOpen size={18} />
        </button>
        <div className="side-rail-label light">本课</div>
      </aside>
    );
  }

  return (
    <aside className="right-panel open" aria-label="本课学习面板">
      <div className="right-panel-header">
        <div>
          <div className="map-label">学习面板</div>
          <div className="map-summary">本课说明和目录</div>
        </div>
        <button
          className="panel-icon-button"
          type="button"
          onClick={onToggle}
          aria-label="收起右侧学习面板"
          title="收起学习面板"
        >
          <PanelRightClose size={18} />
        </button>
      </div>

      <section className="right-card lesson-overview" aria-label="本课介绍">
        <div className="eyebrow">
          <BookOpen size={16} />
          {lesson.phase} · {lesson.level}
        </div>
        <h1>{lesson.title}</h1>
        <p>{lesson.objective}</p>
        <div className="lesson-actions">
          {previousLesson && (
            <button
              className="ghost-button"
              type="button"
              onClick={() => onSelectLesson(previousLesson.id)}
            >
              上一课
            </button>
          )}
          {nextLesson && (
            <button
              className="primary-button"
              type="button"
              onClick={() => onSelectLesson(nextLesson.id)}
            >
              下一课
              <ChevronRight size={17} />
            </button>
          )}
        </div>
        {audioError && <div className="audio-error">{audioError}</div>}
      </section>

      <LessonNavigator
        activeSectionId={activeSectionId}
        onJumpToSection={onJumpToSection}
        onJumpToTop={onJumpToTop}
        sections={lessonSections}
      />
    </aside>
  );
}

function App() {
  const [roadmap, setRoadmap] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [progress, setProgress] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(DEFAULT_LESSON_ID);
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [speakingKey, setSpeakingKey] = useState("");
  const [loadingAudioKey, setLoadingAudioKey] = useState("");
  const [audioError, setAudioError] = useState("");
  const [activeSectionId, setActiveSectionId] = useState("");
  const [error, setError] = useState("");
  const currentAudioRef = useRef(null);
  const progressRef = useRef(null);
  const sectionPlayRunRef = useRef(0);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    return () => {
      currentAudioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    Promise.all([apiGet("/api/roadmap"), apiGet("/api/progress")])
      .then(([roadmapData, progressData]) => {
        setRoadmap(roadmapData);
        setProgress(progressData);
        progressRef.current = progressData;
        setSelectedLessonId(progressData.currentLessonId || DEFAULT_LESSON_ID);
      })
      .catch(() => {
        setError("后端暂时没有响应。请先启动 Flask 服务。");
      });
  }, []);

  useEffect(() => {
    if (!roadmap) {
      return;
    }

    setLesson(null);
    apiGet(`/api/lessons/${selectedLessonId}`)
      .then((lessonData) => {
        setLesson(lessonData);
        recordLessonVisit(lessonData.id);
      })
      .catch(() => {
        setError("这节课的数据还没有准备好。");
      });
  }, [selectedLessonId, roadmap]);

  const lessonSummaries = useMemo(() => {
    return roadmap?.phases?.flatMap((phase) => phase.lessons) || [];
  }, [roadmap]);

  const currentLessonIndex = lessonSummaries.findIndex(
    (item) => item.id === selectedLessonId,
  );
  const previousLesson = lessonSummaries[currentLessonIndex - 1];
  const nextLesson = lessonSummaries[currentLessonIndex + 1];

  const heardBlocks = progress?.heardBlocks || {};
  const visitedLessonIds = progress?.visitedLessons || [];

  const lessonSections = useMemo(() => {
    if (!lesson) {
      return [];
    }

    return lesson.sections.filter((section) => section.blocks.length > 0);
  }, [lesson]);

  useEffect(() => {
    setActiveSectionId(lessonSections[0]?.id || "");
  }, [selectedLessonId, lessonSections]);

  useEffect(() => {
    if (lessonSections.length === 0) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target?.dataset?.sectionId) {
          setActiveSectionId(visibleEntry.target.dataset.sectionId);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: [0.08, 0.18, 0.32],
      },
    );

    lessonSections.forEach((section) => {
      const element = document.getElementById(getSectionAnchorId(section.id));
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [lessonSections]);

  const persistProgress = (nextProgress) => {
    progressRef.current = nextProgress;
    setProgress(nextProgress);

    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextProgress),
    })
      .then((response) => response.json())
      .then((saved) => {
        progressRef.current = saved;
        setProgress(saved);
      })
      .catch(() => {
        setError("进度保存失败，但不会影响你继续学习。");
      });
  };

  const recordLessonVisit = (lessonId) => {
    const current = progressRef.current || {};
    const nextProgress = {
      ...current,
      currentLessonId: lessonId,
      visitedLessons: unique([...(current.visitedLessons || []), lessonId]),
      heardBlocks: current.heardBlocks || {},
    };

    if (
      current.currentLessonId === nextProgress.currentLessonId &&
      (current.visitedLessons || []).includes(lessonId)
    ) {
      return;
    }

    persistProgress(nextProgress);
  };

  const recordAudioPlay = (key, text, audioMeta = {}) => {
    const current = progressRef.current || {};
    persistProgress({
      ...current,
      currentLessonId: selectedLessonId,
      visitedLessons: unique([...(current.visitedLessons || []), selectedLessonId]),
      heardBlocks: {
        ...(current.heardBlocks || {}),
        [key]: {
          at: new Date().toISOString(),
          text,
          ...audioMeta,
        },
      },
    });
  };

  const stopCurrentAudio = () => {
    currentAudioRef.current?.pause();
    currentAudioRef.current = null;
    setSpeakingKey("");
    setLoadingAudioKey("");
  };

  const playEdgeTts = async (text, key, options = {}) => {
    const cleanText = String(text || "").trim();
    if (!cleanText) {
      return;
    }

    if (!options.keepQueue) {
      sectionPlayRunRef.current += 1;
      stopCurrentAudio();
    }

    setAudioError("");
    setLoadingAudioKey(key);
    setSpeakingKey(key);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          lessonId: selectedLessonId,
          text: cleanText,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "法语音频生成失败。");
      }
      if (options.runId && sectionPlayRunRef.current !== options.runId) {
        setLoadingAudioKey("");
        setSpeakingKey("");
        return;
      }

      const audio = new Audio(data.audio_url || data.audio_path);
      currentAudioRef.current = audio;

      const playback = new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          if (currentAudioRef.current === audio) {
            setSpeakingKey("");
          }
          resolve();
        };
        audio.onended = finish;
        audio.onpause = finish;
        audio.onerror = () => {
          settled = true;
          reject(new Error("音频播放失败。"));
        };
      });

      await audio.play();
      setLoadingAudioKey("");
      recordAudioPlay(key, cleanText, {
        audioPath: data.audio_path,
        cached: data.cached,
        engine: data.engine,
        voice: data.voice,
      });

      if (options.waitForEnd) {
        await playback;
      } else {
        playback.catch((err) => {
          setAudioError(err.message || "音频播放失败。");
          setLoadingAudioKey("");
          setSpeakingKey("");
        });
      }
    } catch (err) {
      setAudioError(err.message || "法语音频暂时不可用。");
      setLoadingAudioKey("");
      setSpeakingKey("");
    }
  };

  const speakFrench = (text, key) => {
    playEdgeTts(text, key);
  };

  const playSection = async (section) => {
    const runId = sectionPlayRunRef.current + 1;
    sectionPlayRunRef.current = runId;
    stopCurrentAudio();

    for (const [index, block] of section.blocks.entries()) {
      if (sectionPlayRunRef.current !== runId) {
        break;
      }
      const text = block.audioText || block.text || block.pattern;
      const key = block.id || `section:${section.id}:${index}`;
      await playEdgeTts(text, key, { keepQueue: true, runId, waitForEnd: true });
    }
  };

  const selectLesson = (lessonId) => {
    setError("");
    setSelectedLessonId(lessonId);
  };

  const jumpToSection = (sectionId) => {
    const element = document.getElementById(getSectionAnchorId(sectionId));
    if (!element) {
      return;
    }
    setActiveSectionId(sectionId);
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const jumpToTop = () => {
    document
      .getElementById("lesson-top")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (error && !roadmap) {
    return (
      <main className="boot-state">
        <div className="boot-panel">
          <h1>French Sprint</h1>
          <p>{error}</p>
          <code>cd backend && python app.py</code>
        </div>
      </main>
    );
  }

  if (!lesson || !roadmap || !progress) {
    return (
      <main className="boot-state">
        <Loader2 className="spin" size={28} />
      </main>
    );
  }

  return (
    <div
      className={`app-shell ${isLeftOpen ? "left-open" : "left-collapsed"} ${
        isRightOpen ? "right-open" : "right-collapsed"
      }`}
    >
      <Sidebar
        activeLessonId={selectedLessonId}
        isOpen={isLeftOpen}
        onSelectLesson={selectLesson}
        onToggle={() => setIsLeftOpen((value) => !value)}
        roadmap={roadmap}
        visitedLessonIds={visitedLessonIds}
      />

      <main className="main-content" id="lesson-top">
        <div className="lesson-sections">
          {lessonSections.map((section) => (
            <section
              className="lesson-section"
              data-section-id={section.id}
              id={getSectionAnchorId(section.id)}
              key={section.id}
            >
              <div className="section-heading">
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.note}</p>
                </div>
                <button
                  className="section-play-button"
                  type="button"
                  onClick={() => playSection(section)}
                >
                  <Play size={16} />
                  播放本节
                </button>
              </div>
              <div
                className={
                  section.layout === "compact" || section.id === "alphabet-core"
                    ? "letter-grid"
                    : "content-grid"
                }
              >
                {section.blocks.map((block) => {
                  const heard = Boolean(heardBlocks[block.id]);
                  return (
                    <LessonBlock
                      block={block}
                      heard={heard}
                      key={block.id}
                      loadingAudioKey={loadingAudioKey}
                      onSpeak={speakFrench}
                      speakingKey={speakingKey}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      <RightPanel
        activeSectionId={activeSectionId}
        audioError={audioError}
        isOpen={isRightOpen}
        lesson={lesson}
        lessonSections={lessonSections}
        nextLesson={nextLesson}
        onJumpToSection={jumpToSection}
        onJumpToTop={jumpToTop}
        onSelectLesson={selectLesson}
        onToggle={() => setIsRightOpen((value) => !value)}
        previousLesson={previousLesson}
      />
    </div>
  );
}

export default App;
