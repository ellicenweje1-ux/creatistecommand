import { PRIVATE_CATERING } from '../content/site.js'
import ServiceUmbrella from './ServiceUmbrella.jsx'

export default function PrivateCatering() {
  return <ServiceUmbrella u={PRIVATE_CATERING} lane="private-catering" photos={{ 'the-loaded-bar': '/photos/loaded-bar.jpg', 'private-and-personal': '/photos/g1.jpg', 'the-creatiste-table': '/photos/about-2.jpg' }} />
}
