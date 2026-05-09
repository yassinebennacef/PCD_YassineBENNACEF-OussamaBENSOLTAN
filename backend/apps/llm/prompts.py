LEVEL_LABELS = {
    'beginner':     'débutant',
    'intermediate': 'intermédiaire',
    'advanced':     'avancé',
}


def summarize_prompt(title: str, description: str, level: str, content_excerpt: str = '') -> str:
    level_label     = LEVEL_LABELS.get(level, level)
    content_section = f'\n\nExtrait du contenu :\n{content_excerpt[:1500]}' if content_excerpt else ''
    return (
        f"Tu es un assistant pédagogique. Génère un résumé clair de la ressource éducative "
        f"suivante pour un étudiant de niveau {level_label}.\n\n"
        f"Titre : {title}\n"
        f"Description : {description or 'Aucune description fournie.'}"
        f"{content_section}\n\n"
        f"Rédige un résumé en 4 à 6 phrases. Utilise un vocabulaire adapté au niveau {level_label}. "
        f"Mets en avant l'objectif d'apprentissage et les points clés. "
        f"Réponds uniquement avec le résumé.\n\nRésumé :"
    )


def detailed_summary_prompt(
    title: str, description: str, level: str,
    category: str = '', content_excerpt: str = '', resource_format: str = '',
) -> str:
    level_label     = LEVEL_LABELS.get(level, level)
    format_note     = (
        " (ressource vidéo : basez-vous sur le titre, la description et votre connaissance du domaine)"
        if resource_format == 'video' else ''
    )
    content_section = f'\n\nExtrait du contenu :\n{content_excerpt[:2500]}' if content_excerpt else ''
    return (
        f"Tu es un expert pédagogique. Génère une fiche de révision complète et structurée "
        f"pour la ressource suivante.{format_note} "
        f"La fiche est destinée à un étudiant de niveau {level_label}.\n\n"
        f"Titre : {title}\n"
        f"Catégorie : {category or 'Général'}\n"
        f"Niveau : {level_label}\n"
        f"Description : {description or 'Non fournie.'}"
        f"{content_section}\n\n"
        f"Génère la fiche en respectant exactement cette structure :\n\n"
        f"## Objectifs d'apprentissage\n"
        f"Liste 4 à 6 compétences concrètes que l'étudiant va acquérir.\n\n"
        f"## Concepts clés\n"
        f"Liste 6 à 10 notions fondamentales, chacune avec une définition courte (1-2 phrases).\n\n"
        f"## Résumé du contenu\n"
        f"Résumé détaillé en 4 à 6 paragraphes couvrant les thèmes principaux du cours.\n\n"
        f"## Points importants à retenir\n"
        f"Liste 6 à 8 points essentiels sous forme de bullet points.\n\n"
        f"## Applications pratiques\n"
        f"Donne 3 exemples concrets d'application des connaissances acquises.\n\n"
        f"Réponds directement avec la fiche, sans introduction.\n\nFiche de révision :"
    )


def simplify_prompt(
    title: str, description: str,
    current_level: str, target_level: str,
    content_excerpt: str = '',
) -> str:
    current_label   = LEVEL_LABELS.get(current_level, current_level)
    target_label    = LEVEL_LABELS.get(target_level, target_level)
    content_section = f'\n\nExtrait du contenu :\n{content_excerpt[:1500]}' if content_excerpt else ''
    return (
        f"Tu es un assistant pédagogique spécialisé dans l'adaptation de contenus éducatifs. "
        f"La ressource suivante est de niveau {current_label}. "
        f"Réécris-la de façon simplifiée pour un étudiant de niveau {target_label}.\n\n"
        f"Titre : {title}\n"
        f"Description : {description or 'Aucune description fournie.'}"
        f"{content_section}\n\n"
        f"Consignes :\n"
        f"- Reformule les concepts complexes avec des mots simples\n"
        f"- Utilise des exemples concrets et accessibles\n"
        f"- Garde la structure logique du contenu original\n"
        f"- Réponds avec la version simplifiée uniquement\n\n"
        f"Version simplifiée ({target_label}) :"
    )


def variants_prompt(title: str, description: str, level: str, category: str) -> str:
    level_label = LEVEL_LABELS.get(level, level)
    return (
        f"Tu es un expert en ingénierie pédagogique. Pour la ressource éducative ci-dessous, "
        f"propose 3 variantes de présentation qui facilitent l'apprentissage selon différents styles.\n\n"
        f"Titre : {title}\n"
        f"Catégorie : {category or 'Général'}\n"
        f"Niveau : {level_label}\n"
        f"Description : {description or 'Aucune description fournie.'}\n\n"
        f"Pour chaque variante, indique :\n"
        f"1. Le style d'apprentissage ciblé (visuel, auditif, kinesthésique, lecture/écriture)\n"
        f"2. L'approche pédagogique recommandée\n"
        f"3. Une activité ou exercice concret à proposer\n\n"
        f"Variante 1 — [Style] :\n...\n\nVariante 2 — [Style] :\n...\n\nVariante 3 — [Style] :\n..."
    )


def learning_path_prompt(
    username: str, level: str, field: str, goals: str,
    completed_titles: list, available_resources: list,
) -> str:
    level_label = LEVEL_LABELS.get(level, level)

    completed_str = (
        '\n'.join(f'  - {t}' for t in completed_titles[:10])
        if completed_titles else '  Aucune'
    )
    resources_str = '\n'.join(
        f"  [{i + 1}] {r['title']} "
        f"(niveau: {LEVEL_LABELS.get(r['level'], r['level'])}, "
        f"format: {r['format']}, catégorie: {r['category']})"
        for i, r in enumerate(available_resources[:20])
    )

    return (
        f"Tu es un conseiller pédagogique intelligent. "
        f"Crée un parcours d'apprentissage personnalisé pour l'étudiant suivant.\n\n"
        f"Profil de l'étudiant :\n"
        f"- Nom : {username}\n"
        f"- Niveau actuel : {level_label}\n"
        f"- Domaine d'étude : {field or 'Non spécifié'}\n"
        f"- Objectifs : {goals or 'Non spécifiés'}\n\n"
        f"Ressources déjà complétées :\n{completed_str}\n\n"
        f"Ressources disponibles :\n{resources_str}\n\n"
        f"Consignes :\n"
        f"- Propose un parcours de 5 à 8 ressources ordonnées logiquement\n"
        f"- Justifie brièvement l'ordre choisi\n"
        f"- Adapte le parcours aux objectifs et au niveau de l'étudiant\n"
        f"- Pour chaque étape : numéro de la ressource, titre, et raison du choix\n\n"
        f"Parcours recommandé :"
    )
