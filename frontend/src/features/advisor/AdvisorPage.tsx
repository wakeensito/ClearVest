import { ArrowUp, Trash2, X, MessageCircle } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router'
import { describeError } from '../../api/errors'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dots } from '../../components/ui/Dots'
import { Scout, type ScoutState } from '../../components/companion/Scout'
import { ContextRail } from './ContextRail'
import { PortfolioLab } from './PortfolioLab'
import { CompanyBrief } from './CompanyBrief'
import { OwnershipView } from './OwnershipView'
import { useScoutContext, contextLabel, type ScoutPageContext } from './scoutContext'
import styles from './AdvisorPage.module.css'
import { useChat } from './chatContext'
import { ReplyEvidence } from './ReplyEvidence'
import { ReplyActions } from './ReplyActions'
import { ScoutTarget } from './ScoutTarget'
import { ReplyLearning } from './ReplyLearning'
import { Markdown } from './Markdown'
import { RelatedLesson } from '../../components/education/RelatedLesson'
import { useVoiceTurn } from './useVoiceTurn'
import { VoiceButton, VoiceStatus, VoiceReplyButton } from './VoiceButton'

const MAX = 2000
const TOOLS = [{id:'ownership',label:'What I own'},{id:'scenario',label:'Risk check'},{id:'company',label:'Research'}] as const

export function AdvisorPage() {
  const [params] = useSearchParams()
  const target = params.get('tool')
  return <AdvisorWorkspace key={target ? `${target}:${params.get('symbol')}:${params.get('drop')}` : 'chat'} />
}
function AdvisorWorkspace() {
  const chat = useChat()
  const {draft,setDraft} = chat
  const [params,setParams] = useSearchParams()
  const context = useScoutContext()
  const [tool,setTool] = useState<'conversation'|'ownership'|'scenario'|'company'>(()=>params.get('tool') === 'ownership' ? 'ownership' : params.get('tool') === 'scenario' ? 'scenario' : params.has('symbol')?'company':'conversation')
  const [chatOpen,setShowChat] = useState(()=>!params.has('tool') && (!params.has('symbol') || params.has('q') || params.get('chat') === '1' || chat.busy))
  const showChat = params.has('q') || chatOpen
  const [scenarioContext,setScenarioContext] = useState<ScoutPageContext>({page:'advisor'})
  const [threadContext,setThreadContext] = useState<ScoutPageContext>()
  const pageContext: ScoutPageContext = tool === 'ownership' ? {page:'advisor',metric:'exposure'} : tool === 'scenario' ? scenarioContext : context
  const activeContext = threadContext ?? pageContext
  const [confirming,setConfirming] = useState(false)
  const [clearing,setClearing] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const voice = useVoiceTurn({context:activeContext,onMicDenied:()=>inputRef.current?.focus()})
  const busy = chat.busy
  const thinking = chat.pending || voice.status === 'thinking' || voice.status === 'uploading'
  const state: ScoutState = thinking ? 'thinking' : voice.status === 'recording' ? 'attentive'
    : chat.error || voice.error ? 'unavailable' : voice.status === 'speaking' ? 'ready' : 'attentive'
  const focusComposer = () => requestAnimationFrame(()=>inputRef.current?.focus())
  const openChat = () => {setShowChat(true);focusComposer()}
  const suggest = (question:string) => {setDraft(question);openChat()}
  const discuss = (message:string,selection:ScoutPageContext) => {
    if(busy)return
    setThreadContext(selection);setShowChat(true);chat.send(message,true,selection);focusComposer()
  }
  const selectSymbol = (symbol:string) => {const next=new URLSearchParams(params);next.set('symbol',symbol);setParams(next,{replace:true});setThreadContext(undefined)}
  useEffect(()=>{if(params.has('q')){setDraft((params.get('q')??'').slice(0,MAX));inputRef.current?.focus()}},[params,setDraft])
  useEffect(()=>{if(showChat && threadRef.current)threadRef.current.scrollTop=chat.messages.length || thinking ? threadRef.current.scrollHeight : 0},[showChat,chat.messages.length,thinking])
  const submit = (event?:FormEvent) => {
    event?.preventDefault();if(!draft.trim()||busy)return
    setShowChat(true);chat.send(draft,!!activeContext.metric || !!activeContext.scenario,activeContext);setDraft('')
    const next=new URLSearchParams(params);next.delete('q');setParams(next,{replace:true});focusComposer()
  }
  const keyDown = (event:KeyboardEvent<HTMLTextAreaElement>)=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing)submit(event)}
  const clear = async()=>{setClearing(true);try{voice.stop();await chat.clear();setConfirming(false)}finally{setClearing(false)}}
  const composer = <form className={styles.composer} onSubmit={submit}>
    <label htmlFor="advisor-input" className="sr-only">Your question</label>
    <div className={styles.inputRow}><textarea id="advisor-input" ref={inputRef} value={draft} onChange={e=>setDraft(e.target.value.slice(0,MAX))} onKeyDown={keyDown} rows={1} maxLength={MAX} placeholder="Try: Explain a stock as if this is my first day learning" className={styles.input}/><VoiceButton voice={{...voice,toggle:()=>{setShowChat(true);voice.toggle()}}} disabled={chat.pending}/><button type="submit" className={styles.send} disabled={!draft.trim()||busy} aria-label="Send"><ArrowUp size={20} aria-hidden/></button></div>
    <VoiceStatus voice={voice}/>{draft.length>1800 && <p className={styles.counter}>{draft.length}/{MAX}</p>}
  </form>
  return <div className={styles.page}>
    <header className={styles.heading}>
      <div className={styles.headingTitle}><button className={styles.scoutButton} aria-label="Ask Scout a question" onClick={openChat}><Scout state={state} engaged/></button><h1>Ask about your money</h1></div>
      <button className={styles.clearHistory} disabled={busy || !chat.messages.length} onClick={()=>setConfirming(true)}><Trash2 size={17} aria-hidden/><span>Clear history</span></button>
    </header>
    <nav className={styles.navigation} aria-label="Advisor views">
      <button className={styles.chatToggle} aria-label="Ask Scout" aria-pressed={showChat} onClick={openChat}><MessageCircle size={16} aria-hidden/><span>Ask Scout</span></button>
      <div className={styles.toolTabs} role="group" aria-label="Advisor tools">{TOOLS.map(item=><button key={item.id} aria-pressed={!showChat && tool===item.id} onClick={()=>{setTool(item.id);setThreadContext(undefined);setShowChat(false)}}>{item.label}</button>)}</div>
    </nav>
    <div className={styles.layout}>
      <div className={styles.mainColumn}>
        {tool!=='conversation' && <div className={styles.workbench} hidden={showChat}>
          {tool==='ownership' && <ScoutTarget name="ownership"><OwnershipView onDiscuss={discuss} busy={busy} focusSymbol={params.get('tool') === 'ownership' ? context.symbol : undefined}/></ScoutTarget>}
          {tool==='scenario' && <ScoutTarget name="scenario"><PortfolioLab onDiscuss={discuss} onContextChange={setScenarioContext} busy={busy} initialSymbol={params.get('tool') === 'scenario' ? context.symbol : undefined} initialDrop={Number(params.get('drop') ?? 20)}/></ScoutTarget>}
          {tool==='company' && <CompanyBrief key={context.symbol} symbol={context.symbol??''} onSelect={selectSymbol} onDiscuss={discuss} busy={busy}/>}
        </div>}
        {showChat && <section className={styles.chat} aria-label="Conversation with Scout">
          {tool!=='conversation' && <div className={styles.chatHeading}><p>{contextLabel(activeContext)}</p><button aria-label="Close conversation" onClick={()=>setShowChat(false)}><span>Back to {TOOLS.find(item=>item.id===tool)?.label.toLowerCase()}</span><X size={16} aria-hidden/></button></div>}
        {threadContext && <button className={styles.resetContext} onClick={()=>setThreadContext(undefined)}>Use current page</button>}
        <div className={styles.thread} ref={threadRef} aria-live="polite" aria-busy={thinking}>
          {!chat.messages.length && <div className={styles.empty}>
            <h2>What would you like to understand?</h2>
            <p>Start with a question. Scout can help you understand what you own, unpack a term, or explore an example.</p>
            <div className={styles.starters}>
              <button onClick={()=>suggest('Explain my portfolio in plain language.')}>Explain my portfolio</button>
              <button onClick={()=>suggest('How risky is my portfolio?')}>How risky is my portfolio?</button>
              <button onClick={()=>suggest('What does diversification mean? Give me a simple example.')}>Explain a term</button>
            </div>
          </div>}
          {chat.messages.map(message=>message.role==='user'?<div key={message.id} className={styles.userRow}><p className={styles.user}>{message.text}</p>{message.failed && <p className={styles.failed}>{chat.error?describeError(chat.error,'Scout'):'Reply unavailable.'} <button disabled={busy} onClick={()=>chat.retry(message.id)}>Retry</button></p>}</div>:<article key={message.id} className={styles.advisor}><p>Scout</p><div className={styles.reply}><Markdown text={message.text} explain/><ReplyEvidence message={message}/><ReplyActions message={message} onNavigate={destination => { voice.stop(); const nextTool = new URLSearchParams(destination.split('?')[1]).get('tool'); if (destination.startsWith('/advisor?') && (nextTool === 'ownership' || nextTool === 'scenario')) { setTool(nextTool); setThreadContext(undefined); setShowChat(false) } }}/><VoiceReplyButton voice={voice} text={message.text} id={message.id} disabled={busy}/><RelatedLesson text={message.text}/></div></article>)}
          {!busy && chat.messages.at(-1)?.role==='advisor' && <div className={styles.followups} aria-label="Explore this answer">
            <button onClick={()=>suggest('Can you explain that more simply?')}>Make it simpler</button>
            <button onClick={()=>suggest('Can you give me a concrete example?')}>Give me an example</button>
          </div>}
          {!busy && chat.messages.at(-1)?.role==='advisor' && <ReplyLearning key={chat.messages.at(-1)!.id} message={chat.messages.at(-1)!}/> }
          {thinking && <p className={styles.pending}><Dots/>Thinking it through…</p>}
        </div>
          {composer}
        </section>}
        {!showChat && <div className={styles.quickAsk}>{composer}</div>}
        <p className={styles.disclaimer}>{chat.disclaimer}</p>
      </div>
      <ContextRail/>
    </div>
    <ConfirmDialog open={confirming} title="Clear chat history?" confirmLabel="Clear history" busy={clearing} onConfirm={()=>void clear()} onClose={()=>setConfirming(false)}>Your conversation will be cleared. Your profile and linked account stay as they are.</ConfirmDialog>
  </div>
}
