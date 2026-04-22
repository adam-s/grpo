<script lang="ts">
  import Section from '../lib/components/Section.svelte';
  import Prose from '../lib/components/Prose.svelte';
  import Math from '../lib/components/Math.svelte';
  import RLLoopDiagram from '../lib/components/viz/RLLoopDiagram.svelte';
</script>

<Section eyebrow="Background" title="Reinforcement learning, via a cube" id="background">
  <Prose>
    <p>
      Before the math, let's establish intuition. Every reinforcement learning 
      setup relies on an <strong>agent</strong> interacting with an <strong>environment</strong>.
    </p>
    <p>
      Here, my tiny Transformer is the agent and the Rubik's cube is the environment. The policy is a probability distribution over moves—training adjusts weights <Math tex={String.raw`\theta`} speak="theta" /> to make better moves more likely. At each step, an <strong>action</strong> <Math tex="a_t" speak="a-t" /> (like R, U', or F) updates the cube to a new <strong>state</strong> <Math tex="s_t" speak="s-t" />, feeding back into the model until the sequence forms a complete <strong>trajectory</strong> <Math tex={String.raw`\tau`} speak="tau" />.
    </p>
  </Prose>

  <RLLoopDiagram />

  <Prose>
    <p>
      The catch is the reward: it is brutally sparse. The model receives
      <Math tex="R = 1" speak="R-eq-1" /> if the final state is solved, and
      <Math tex="R = 0" speak="R-eq-0" /> otherwise. Intermediate moves get zero
      feedback. This creates a severe <strong>credit assignment</strong> problem—if
      the model outputs ten moves and the cube remains scrambled, which specific move
      was the fatal mistake? A single terminal reward offers no clues.
    </p>
    <p>
      Classical RL solves this by training a second "critic" network to estimate intermediate state values. GRPO goes a leaner route: it discards the critic entirely.
    </p>
    <p>
      Instead of predicting value, it samples <Math tex="G" speak="G" /> trajectories from the same scramble and scores them all. The group's average score becomes the baseline. Sequences beating the average earn a positive advantage; those below earn a negative one. The group <em>is</em> the critic.
    </p>
  </Prose>
</Section>