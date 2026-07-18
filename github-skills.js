/*
 * Fantamon Boss Builder - armazenamento leve de skills
 *
 * Este arquivo sobrescreve apenas a função addMultipleSkills() do script.js.
 * As imagens NÃO são convertidas para Base64.
 * O navegador salva somente caminhos como:
 *   assets/skills/mage/chaos-stream.png
 *
 * IMPORTANTE:
 * antes de registrar as skills no site, envie os mesmos arquivos para
 * a pasta assets/skills/<id-da-classe>/ no GitHub.
 */

(function () {
  function safeFileName(fileName) {
    // Mantém o nome do arquivo, mas remove barras para impedir caminhos inválidos.
    return String(fileName || "")
      .replace(/[\\/]+/g, "-")
      .trim();
  }

  function isBase64Image(value) {
    return typeof value === "string" && value.startsWith("data:image/");
  }

  function removeOldBase64CustomSkills() {
    // Não apaga automaticamente para evitar perda de dados.
    // Apenas detecta para informar o usuário.
    let count = 0;
    Object.values(state.customSkills || {}).forEach(list => {
      if (!Array.isArray(list)) return;
      list.forEach(skill => {
        if (isBase64Image(skill?.image)) count++;
      });
    });
    return count;
  }

  window.addMultipleSkills = async function addMultipleSkills(files) {
    const classKey = el("classSelect").value;
    const validFiles = [...files].filter(file => file.type.startsWith("image/"));

    if (validFiles.length === 0) {
      alert("Selecione arquivos de imagem válidos.");
      return;
    }

    if (!state.customSkills) state.customSkills = {};
    if (!Array.isArray(state.customSkills[classKey])) {
      state.customSkills[classKey] = [];
    }

    let added = 0;
    let duplicated = 0;

    for (const file of validFiles) {
      const fileName = safeFileName(file.name);
      if (!fileName) continue;

      const imagePath = `assets/skills/${classKey}/${fileName}`;
      const name = filenameToSkillName(fileName);

      const alreadyExists = state.customSkills[classKey].some(skill =>
        skill.image === imagePath ||
        String(skill.name || "").toLowerCase() === name.toLowerCase()
      );

      if (alreadyExists) {
        duplicated++;
        continue;
      }

      state.customSkills[classKey].push({
        id: uid(`custom_${classKey}`),
        name,
        image: imagePath,
        custom: true
      });

      added++;
    }

    if (!saveState()) {
      alert("Não foi possível salvar a lista das skills.");
      return;
    }

    renderSkillLibrary();

    const className = el("classSelect").selectedOptions[0]?.text || classKey;
    let message = `${added} skill${added === 1 ? "" : "s"} registrada${added === 1 ? "" : "s"} para ${className}.`;

    if (duplicated > 0) {
      message += ` ${duplicated} duplicada${duplicated === 1 ? "" : "s"} ignorada${duplicated === 1 ? "" : "s"}.`;
    }

    message += `\n\nAs imagens precisam existir no GitHub em:\nassets/skills/${classKey}/`;

    alert(message);
  };

  // A função original do script.js foi ligada ao evento "change" antes deste
  // arquivo carregar. Substituímos o comportamento do input diretamente para
  // garantir que nenhum arquivo seja convertido em Base64.
  const input = document.getElementById("skillFilesInput");
  if (input) {
    const replacement = input.cloneNode(true);
    input.parentNode.replaceChild(replacement, input);

    replacement.addEventListener("change", async () => {
      const files = replacement.files;
      if (files?.length) {
        await window.addMultipleSkills(files);
      }
      replacement.value = "";
    });
  }

  const addButton = document.getElementById("addSkillsBtn");
  if (addButton) {
    const replacementButton = addButton.cloneNode(true);
    addButton.parentNode.replaceChild(replacementButton, addButton);

    replacementButton.addEventListener("click", () => {
      document.getElementById("skillFilesInput")?.click();
    });
  }

  const removeAllButton = document.getElementById("removeAllClassSkillsBtn");
  if (removeAllButton) {
    removeAllButton.addEventListener("click", () => {
      const classKey = el("classSelect").value;
      const className = el("classSelect").selectedOptions[0]?.text || classKey;
      const skills = Array.isArray(state.customSkills?.[classKey])
        ? state.customSkills[classKey]
        : [];

      if (skills.length === 0) {
        alert(`A classe ${className} não possui skills personalizadas para remover.`);
        return;
      }

      const confirmed = confirm(
        `Remover todas as ${skills.length} skills da classe ${className}?\n\n` +
        `Esta ação remove as skills cadastradas no navegador, mas NÃO apaga os arquivos de imagem do GitHub.`
      );

      if (!confirmed) return;

      state.customSkills[classKey] = [];

      if (!saveState()) {
        alert("Não foi possível salvar a remoção das skills.");
        return;
      }

      renderSkillLibrary();
      alert(`Todas as skills personalizadas da classe ${className} foram removidas.`);
    });
  }

  const oldBase64Count = removeOldBase64CustomSkills();
  if (oldBase64Count > 0) {
    console.warn(
      `Fantamon Boss Builder: ${oldBase64Count} skill(s) antiga(s) ainda usam Base64 no localStorage.`
    );
  }
})();


/*
 * Sincronização de nome da classe com a pasta no GitHub.
 * Ex.: Priest renomeada para Scholar:
 *   ID antigo: priest
 *   Novo ID: scholar
 *   Pasta: assets/skills/scholar/
 */
(function setupClassRenameFolderSync() {
  function slugifyClassName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function migrateClassKey(oldKey, newKey) {
    if (!oldKey || !newKey || oldKey === newKey) return true;

    if (!state.customSkills) state.customSkills = {};
    const oldSkills = Array.isArray(state.customSkills[oldKey]) ? state.customSkills[oldKey] : [];
    const newSkills = Array.isArray(state.customSkills[newKey]) ? state.customSkills[newKey] : [];

    // Atualiza os caminhos das imagens já registradas para a nova pasta.
    const migrated = oldSkills.map(skill => {
      const updated = { ...skill };
      if (typeof updated.image === "string" && updated.image.startsWith(`assets/skills/${oldKey}/`)) {
        updated.image = updated.image.replace(
          `assets/skills/${oldKey}/`,
          `assets/skills/${newKey}/`
        );
      }
      return updated;
    });

    state.customSkills[newKey] = [...newSkills, ...migrated];
    delete state.customSkills[oldKey];

    // Atualiza referências de classe nas skills colocadas nas estratégias, se existirem.
    Object.values(state.bosses || {}).forEach(boss => {
      (boss.strategies || []).forEach(strategy => {
        (strategy.slots || []).forEach(slot => {
          (slot.skills || []).forEach(skill => {
            if (skill.classKey === oldKey) skill.classKey = newKey;
            if (typeof skill.image === "string" && skill.image.startsWith(`assets/skills/${oldKey}/`)) {
              skill.image = skill.image.replace(
                `assets/skills/${oldKey}/`,
                `assets/skills/${newKey}/`
              );
            }
          });
        });
      });
    });

    return true;
  }

  // Observa o botão de renomear classe. O script principal continua abrindo/realizando
  // o rename normalmente; depois sincronizamos a chave interna com o novo nome.
  const renameBtn = document.getElementById("renameClassBtn");
  if (!renameBtn) return;

  renameBtn.addEventListener("click", () => {
    const select = document.getElementById("classSelect");
    const oldKey = select?.value;

    // Aguarda o handler original terminar.
    setTimeout(() => {
      const classes = Array.isArray(state.classes) ? state.classes : [];
      let renamedClass = classes.find(c => c.id === oldKey);

      // Compatibilidade caso o script use key/value em vez de id/name.
      if (!renamedClass) renamedClass = classes.find(c => c.key === oldKey);

      const displayName =
        renamedClass?.name ||
        renamedClass?.label ||
        document.getElementById("classNameEditor")?.value;

      const newKey = slugifyClassName(displayName);
      if (!oldKey || !newKey || oldKey === newKey) return;

      migrateClassKey(oldKey, newKey);

      if (renamedClass) {
        if ("id" in renamedClass) renamedClass.id = newKey;
        if ("key" in renamedClass) renamedClass.key = newKey;
      }

      if (saveState()) {
        if (typeof renderClassOptions === "function") renderClassOptions();
        if (typeof renderClassManager === "function") renderClassManager();

        const refreshedSelect = document.getElementById("classSelect");
        if (refreshedSelect) refreshedSelect.value = newKey;

        if (typeof renderSkillLibrary === "function") renderSkillLibrary();
      }
    }, 0);
  }, true);
})();
