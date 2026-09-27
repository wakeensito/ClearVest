import { describe, expect, it } from 'vitest'
import type { Holdings } from '../api/client'
import { scenarioResult } from './scenario'
const row = {symbol:'NVDA',name:'Nvidia',value:4000,type:'equity',quantity:40,price:100,weight:.4}
const data: Holdings = {asOf:'2026-09-26',totalValue:10000,holdings:[row,{...row,value:2000,weight:.2},{...row,symbol:'CASH',type:'cash',value:4000}]}
describe('a hypothetical holding price shock',()=>{
  it('aggregates duplicate positions and distinguishes stock drop from portfolio drop',()=>{
    expect(scenarioResult(data,'NVDA',20)).toMatchObject({loss:1200,after:8800,portfolioDropPct:12,positionValue:6000})
  })
  it('handles zero and rounds a half-cent loss to cents',()=>{
    expect(scenarioResult(data,'NVDA',0)?.loss).toBe(0)
    expect(scenarioResult({...data,holdings:[{...row,value:.05}]},'NVDA',10)?.loss).toBe(.01)
  })
  it('withholds unsupported cases instead of making an illustration look trustworthy',()=>{
    expect(scenarioResult(data,'MSFT',20)).toBeNull()
    expect(scenarioResult(data,'NVDA',61)).toBeNull()
    expect(scenarioResult({...data,holdings:[{...row,value:-1}]},'NVDA',20)).toBeNull()
    expect(scenarioResult({...data,holdings:[{...row,type:'derivative'}]},'NVDA',20)).toBeNull()
  })
})
