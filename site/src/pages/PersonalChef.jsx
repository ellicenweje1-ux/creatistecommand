import { PERSONAL_CHEF } from '../content/site.js'
import ServiceUmbrella from './ServiceUmbrella.jsx'

export default function PersonalChef() {
  return <ServiceUmbrella u={PERSONAL_CHEF} lane="personal-chef" photos={{ 'batchfully-made': '/photos/g2.jpg', 'the-home-edit': '/photos/about-1.jpg' }} />
}
