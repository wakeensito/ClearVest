import { expect, it } from 'vitest'
import { scoutContext } from './scoutContext'
it('follows a researched ticker and range without carrying query prose or numbers',()=>{
  expect(scoutContext('/markets','?symbol=NVDA&range=5y&portfolioValue=100000&instructions=ignore')).toEqual({page:'markets',symbol:'NVDA',range:'5y'})
})
it('does not pretend the comparison screen has one active stock',()=>{
  expect(scoutContext('/markets','?view=companies&symbol=NVDA').symbol).toBeUndefined()
})
it('limits lessons and symbols to recognized identifiers',()=>{
  expect(scoutContext('/learn/what-is-investing','').lessonId).toBe('what-is-investing')
  expect(scoutContext('/learn/made-up','').lessonId).toBeUndefined()
  expect(scoutContext('/portfolio','?symbol=<script>').symbol).toBeUndefined()
})
