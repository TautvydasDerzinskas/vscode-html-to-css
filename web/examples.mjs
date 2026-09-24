/**
 * Samples for the "Try an example" buttons, per conversion direction. Shared by the build,
 * which pre-renders the first HTML one into the static page, and by the browser bundle.
 */
export const EXAMPLES = [
  {
    id: 'html',
    direction: 'html-to-css',
    label: 'HTML',
    code: `<div class="card">
  <div class="card__header card__header--featured">
    <h2 class="card__title">Title</h2>
  </div>
  <div class="card__body">
    <p class="card__text">Content</p>
    <a href="#" class="card__link">Read more</a>
  </div>
</div>`,
  },
  {
    id: 'jsx',
    direction: 'html-to-css',
    label: 'JSX / React',
    code: `<div className="card">
  <button className="card__btn" onClick={() => setOpen(true)} style={{ color: 'red' }}>
    {label}
  </button>
  {items.map(item => (
    <span className={styles.item} key={item.id}>
      {item.name}
    </span>
  ))}
</div>`,
  },
  {
    id: 'twig',
    direction: 'html-to-css',
    label: 'Twig',
    code: `{% block card %}
<div class="card {{ extraClass }}">
  {# the header #}
  <div class="card__header {% if featured %}card__header--featured{% endif %}">
    <h2 class="card__title">{{ title }}</h2>
  </div>
  {% for item in items %}
    <div class="card__item card__item--{{ item.type }}">{{ item.name }}</div>
  {% endfor %}
</div>
{% endblock %}`,
  },
  {
    id: 'vue',
    direction: 'html-to-css',
    label: 'Vue',
    code: `<template>
  <nav class="menu">
    <a v-for="link in links" :key="link.url" class="menu__link" :href="link.url">
      {{ link.title }}
    </a>
    <button class="menu__toggle" @click="open = !open">Menu</button>
  </nav>
</template>`,
  },
  {
    id: 'handlebars',
    direction: 'html-to-css',
    label: 'Handlebars',
    code: `<ul class="list">
  {{#each items}}
    <li class="list__item {{#if active}}list__item--active{{/if}}">
      <span class="list__label">{{name}}</span>
    </li>
  {{/each}}
</ul>`,
  },
  {
    id: 'scss',
    direction: 'css-to-html',
    label: 'SCSS',
    code: `.card {
  &--featured {}

  &__header {
    .card__title {}
  }

  &__body {
    .card__text {}

    a.card__link {
      &:hover {}
    }
  }
}`,
  },
  {
    id: 'css',
    direction: 'css-to-html',
    label: 'CSS',
    code: `.nav {}
.nav .nav__list {}
.nav .nav__list > li {}
.nav .nav__list > li > a.nav__link:hover {}
.nav .nav__toggle {}`,
  },
  {
    id: 'less',
    direction: 'css-to-html',
    label: 'LESS',
    code: `@gap: 16px;

.rounded(@radius: 4px) {
  border-radius: @radius;
}

.form {
  .rounded();

  &-row {
    label[for=email] {}
    input.form__input[type=email] {}
  }

  button[type=submit] {}
}`,
  },
];
